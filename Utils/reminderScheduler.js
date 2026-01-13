const cron = require('node-cron');
const Settings = require('../Models/settingsModel');
const User = require('../Models/user');
const Quotation = require('../Models/quotationModel');
const BOM = require('../Models/bomModel');
const Order = require('../Models/orderModel');
const Invoice = require('../Models/invoice');
const { sendEmail } = require('./emailUtil');

const getDayRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
};

const shouldSendForCompany = (settings, key) => {
  if (!settings) return true;
  if (settings.notifications && settings.notifications.emailNotification === false) {
    return false;
  }
  if (settings.notifications && settings.notifications[key] === false) {
    return false;
  }
  return true;
};

const buildEmailHtml = (companyName, buckets, targetDate) => {
  const sections = [];
  if (buckets.quotations.length) {
    const items = buckets.quotations
      .map(q => `<li>${q.quotationNumber || q._id} — ${q.clientName} (Due: ${formatDate(q.dueDate)})</li>`)
      .join('');
    sections.push(`<h3>Quotations Due</h3><ul>${items}</ul>`);
  }
  if (buckets.boms.length) {
    const items = buckets.boms
      .map(b => `<li>${b.bomNumber || b._id} — ${b.name} (Due: ${formatDate(b.dueDate)})</li>`)
      .join('');
    sections.push(`<h3>BOMs Due</h3><ul>${items}</ul>`);
  }
  if (buckets.orders.length) {
    const items = buckets.orders
      .map(o => `<li>${o.orderNumber || o._id} — ${o.clientName} (Ends: ${formatDate(o.endDate)})</li>`)
      .join('');
    sections.push(`<h3>Orders Due</h3><ul>${items}</ul>`);
  }
  if (buckets.invoices.length) {
    const items = buckets.invoices
      .map(i => `<li>${i.invoiceNumber || i._id} — ${i.clientName} (Due: ${formatDate(i.dueDate)})</li>`)
      .join('');
    sections.push(`<h3>Invoices Due</h3><ul>${items}</ul>`);
  }

  if (!sections.length) {
    return null;
  }

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Upcoming Deadlines (in 2 days)</h2>
      <p>Company: <strong>${companyName}</strong></p>
      <p>Date: <strong>${formatDate(targetDate)}</strong></p>
      ${sections.join('')}
      <p style="margin-top: 20px;">This is an automated reminder from your system.</p>
    </div>
  `;
};

const fetchSettingsMap = async () => {
  const settingsList = await Settings.find().lean();
  const map = new Map();
  settingsList.forEach(s => map.set(s.companyName, s));
  return map;
};

const fetchCompanyUsers = async (companyName) => {
  const users = await User.find({ 'companies.name': companyName })
    .select('email fullname companies')
    .lean();
  return users.filter(u => {
    const company = u.companies.find(c => c.name === companyName);
    return company && company.accessGranted;
  });
};

const runDailyReminders = async () => {
  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2);
    const { start, end } = getDayRange(targetDate);

    const [quotations, boms, orders, invoices] = await Promise.all([
      Quotation.find({
        dueDate: { $gte: start, $lte: end },
        status: { $nin: ['completed', 'rejected'] }
      }).lean(),
      BOM.find({
        dueDate: { $gte: start, $lte: end }
      }).lean(),
      Order.find({
        endDate: { $gte: start, $lte: end },
        status: { $nin: ['completed', 'cancelled'] }
      }).lean(),
      Invoice.find({
        dueDate: { $gte: start, $lte: end },
        status: { $nin: ['paid', 'cancelled'] }
      }).lean()
    ]);

    const settingsMap = await fetchSettingsMap();
    const companyBuckets = new Map();

    const pushToBucket = (companyName, key, item) => {
      if (!companyBuckets.has(companyName)) {
        companyBuckets.set(companyName, { quotations: [], boms: [], orders: [], invoices: [] });
      }
      companyBuckets.get(companyName)[key].push(item);
    };

    quotations.forEach(q => pushToBucket(q.companyName, 'quotations', q));
    boms.forEach(b => pushToBucket(b.companyName, 'boms', b));
    orders.forEach(o => pushToBucket(o.companyName, 'orders', o));
    invoices.forEach(i => pushToBucket(i.companyName, 'invoices', i));

    for (const [companyName, buckets] of companyBuckets.entries()) {
      const settings = settingsMap.get(companyName);

      const allowedBuckets = {
        quotations: shouldSendForCompany(settings, 'quotationReminders') ? buckets.quotations : [],
        boms: shouldSendForCompany(settings, 'projectDeadlines') ? buckets.boms : [],
        orders: shouldSendForCompany(settings, 'projectDeadlines') ? buckets.orders : [],
        invoices: shouldSendForCompany(settings, 'projectDeadlines') ? buckets.invoices : []
      };

      const html = buildEmailHtml(companyName, allowedBuckets, targetDate);
      if (!html) {
        continue;
      }

      const users = await fetchCompanyUsers(companyName);
      const subject = `Deadline reminders for ${companyName}`;

      await Promise.all(
        users.map(u => sendEmail({ to: u.email, subject, html }))
      );
    }
  } catch (error) {
    console.error('Daily reminders error:', error);
  }
};

exports.startReminderScheduler = () => {
  const timezone = process.env.REMINDER_TIMEZONE;
  cron.schedule('0 9 * * *', runDailyReminders, timezone ? { timezone } : undefined);
  console.log('✅ Reminder scheduler started (daily 9:00)');
};
