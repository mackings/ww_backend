const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate an invoice PDF and save to filePath
 * @param {Object} invoice - Invoice document from MongoDB
 * @param {string} filePath - Destination path for the PDF
 * @returns {Promise<string>} - Resolves with file path after writing
 */
async function generateInvoicePDF(invoice, filePath) {
  return new Promise((resolve, reject) => {
    try {
      // ✅ Ensure tmp directory exists
      const tmpDir = path.dirname(filePath);
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
        console.log('📁 tmp directory created automatically');
      }

      const doc = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // ---------------------------
      // HEADER
      // ---------------------------
      doc
        .fontSize(22)
        .fillColor('#333333')
        .text('INVOICE', { align: 'center' })
        .moveDown();

      doc
        .fontSize(12)
        .fillColor('#555555')
        .text(`Invoice Number: ${invoice.quotationNumber}`)
        .text(`Date: ${new Date().toDateString()}`)
        .text(`Due Date: ${new Date(invoice.dueDate).toDateString()}`)
        .moveDown();

      // ---------------------------
      // CLIENT DETAILS
      // ---------------------------
      doc
        .fontSize(13)
        .fillColor('#000000')
        .text('Bill To:', { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(12)
        .fillColor('#333333')
        .text(`Client Name: ${invoice.clientName}`)
        .text(`Email: ${invoice.email}`)
        .text(`Phone: ${invoice.phoneNumber}`)
        .text(`Address: ${invoice.clientAddress || ''}`)
        .text(`Nearest Bus Stop: ${invoice.nearestBusStop || ''}`)
        .moveDown();

      // ---------------------------
      // ITEMS TABLE
      // ---------------------------
      doc
        .fontSize(13)
        .fillColor('#000000')
        .text('Items / Services', { underline: true })
        .moveDown(0.5);

      if (Array.isArray(invoice.items) && invoice.items.length > 0) {
        invoice.items.forEach((item, i) => {
          const name = item.name || item.description || 'Item';
          const quantity = item.quantity || 1;
          const price = item.price || 0;
          const total = quantity * price;

          doc
            .fontSize(12)
            .fillColor('#333333')
            .text(
              `${i + 1}. ${name} - ₦${price.toLocaleString()} x ${quantity} = ₦${total.toLocaleString()}`
            );
        });
      } else {
        doc.text('No items listed.');
      }

      doc.moveDown();

      // ---------------------------
      // SUMMARY
      // ---------------------------
      doc
        .fontSize(12)
        .fillColor('#333333')
        .text(`Discount: ₦${invoice.discountAmount || 0}`)
        .text(`Amount Paid: ₦${invoice.amountPaid || 0}`)
        .moveDown(0.5);

      doc
        .fontSize(14)
        .fillColor('#000000')
        .text(`Final Total: ₦${invoice.finalTotal.toLocaleString()}`, { align: 'right' })
        .moveDown(1.5);

      // ---------------------------
      // NOTES / FOOTER
      // ---------------------------
      if (invoice.notes) {
        doc
          .fontSize(12)
          .fillColor('#555555')
          .text(`Notes: ${invoice.notes}`)
          .moveDown(1);
      }

      doc
        .fontSize(10)
        .fillColor('#777777')
        .text('Thank you for your business!', { align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(filePath));
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = generateInvoicePDF;

