const Invoice = require('../../Models/invoice'); 
const Quotation = require('../../Models/quotationModel'); 
const User = require('../../Models/user');
const ApiResponse = require('../../Utils/apiResponse');

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const multer = require("multer");

const { sendEmail } = require('../../Utils/emailUtil');
const generateInvoicePDF = require("../../Utils/GenPDF");
const { notifyCompany } = require('../../Utils/NotHelper');


const storage = multer.diskStorage({
  destination: '/tmp',
  filename: (req, file, cb) => {
    cb(null, `invoice_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * @desc    Create invoice from quotation
 * @route   POST /api/invoices
 * @access  Private
 */
exports.createInvoiceFromQuotation = async (req, res) => {
  try {
    const { quotationId, dueDate, notes, amountPaid } = req.body;

    // Validate quotation exists and belongs to company
    const quotation = await Quotation.findOne({
      _id: quotationId,
      companyName: req.companyName, // ✅ Filter by company
    });

    if (!quotation) {
      return ApiResponse.error(res, 'Quotation not found or unauthorized', 404);
    }

    // Check quotation status
    if (quotation.status !== 'approved' && quotation.status !== 'sent' && quotation.status !== 'draft') {
      return ApiResponse.error(res, 'Only approved, sent, or draft quotations can be converted to invoices', 400);
    }

    // Create invoice
    const invoice = new Invoice({
      userId: req.user._id,
      companyName: req.companyName, // ✅ Add company name
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      clientName: quotation.clientName,
      clientAddress: quotation.clientAddress,
      nearestBusStop: quotation.nearestBusStop,
      phoneNumber: quotation.phoneNumber,
      email: quotation.email,
      description: quotation.description,
      items: quotation.items,
      service: quotation.service,
      discount: quotation.discount,
      totalCost: quotation.totalCost,
      totalSellingPrice: quotation.totalSellingPrice,
      discountAmount: quotation.discountAmount,
      finalTotal: quotation.finalTotal,
      amountPaid: amountPaid || 0,
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: notes || '',
    });

    await invoice.save();

    // Update quotation status
    quotation.status = 'sent';
    await quotation.save();

    // Check if PDF was uploaded from mobile
    let pdfPath = null;
    const uploadedPdf = req.file;

    if (uploadedPdf) {
      pdfPath = uploadedPdf.path;
      console.log('✅ Using PDF from mobile:', pdfPath);
    } else {
      try {
        pdfPath = `/tmp/invoice_${invoice._id}.pdf`;
        await generateInvoicePDF(invoice, pdfPath);
        console.log('✅ PDF generated on backend at:', pdfPath);
      } catch (pdfError) {
        console.error('❌ PDF generation failed:', pdfError);
      }
    }

    // Send PDF invoice via email
    if (pdfPath && quotation.email) {
      try {
        console.log('📧 Sending email to:', quotation.email);
        console.log('📎 Attaching PDF from:', pdfPath);

        await sendEmail({
          to: quotation.email,
          subject: `Invoice ${invoice.invoiceNumber} for Quotation #${quotation.quotationNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #A16438;">Invoice from Woodworker</h2>
              <p>Dear ${quotation.clientName},</p>
              <p>Thank you for your business. Please find your invoice <strong>${invoice.invoiceNumber}</strong> attached below.</p>
              
              <div style="background-color: #f5f8f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #333;">Invoice Summary</h3>
                <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
                <p><strong>Quotation Number:</strong> ${quotation.quotationNumber}</p>
                <p><strong>Total Amount:</strong> ₦${invoice.finalTotal.toLocaleString()}</p>
                <p><strong>Amount Paid:</strong> ₦${invoice.amountPaid.toLocaleString()}</p>
                <p><strong>Balance Due:</strong> ₦${invoice.balance.toLocaleString()}</p>
                <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toDateString()}</p>
                <p><strong>Payment Status:</strong> <span style="color: ${invoice.paymentStatus === 'paid' ? '#28a745' : '#dc3545'}; font-weight: bold;">${invoice.paymentStatus.toUpperCase()}</span></p>
              </div>
              
              ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
              
              <p>We appreciate your business and look forward to serving you again.</p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            </div>
          `,
          attachments: [
            {
              filename: `Invoice_${invoice.invoiceNumber}_${quotation.quotationNumber}.pdf`,
              path: pdfPath,
            },
          ],
        });

        console.log('✅ Email sent successfully to:', quotation.email);

        // Clean up temp PDF
        fs.unlink(pdfPath, (err) => {
          if (err) {
            console.error('⚠️ Error deleting temp PDF:', err.message);
          } else {
            console.log('🗑️ Temp PDF deleted:', pdfPath);
          }
        });
      } catch (emailError) {
        console.error('❌ Error sending email:', emailError);
      }
    }

    // Get current user
    const currentUser = await User.findById(req.user._id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'invoice_created',
      title: 'New Invoice Created',
      message: `${currentUser.fullname} created invoice ${invoice.invoiceNumber} for ${quotation.clientName}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        quotationNumber: quotation.quotationNumber,
        clientName: quotation.clientName,
        finalTotal: invoice.finalTotal.toFixed(2),
        amountPaid: invoice.amountPaid.toFixed(2),
        balance: invoice.balance.toFixed(2),
        paymentStatus: invoice.paymentStatus
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Invoice created successfully and sent via email', invoice, 201);
  } catch (error) {
    console.error('Create invoice error:', error);
    return ApiResponse.error(res, error.message || 'Server error creating invoice', 500);
  }
};

// Export multer middleware
exports.uploadPdf = upload.single('invoicePdf');

/**
 * @desc    Get all invoices
 * @route   GET /api/invoices
 * @access  Private
 */
exports.getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Filter by company
    const filter = { companyName: req.companyName };

    if (status) {
      filter.status = status;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { quotationNumber: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('quotationId', 'quotationNumber status')
        .lean(),
      Invoice.countDocuments(filter)
    ]);

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalInvoices: total,
      limit: parseInt(limit)
    };

    return ApiResponse.success(res, 'Invoices fetched successfully', {
      invoices,
      pagination
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return ApiResponse.error(res, 'Server error fetching invoices', 500);
  }
};

/**
 * @desc    Get single invoice
 * @route   GET /api/invoices/:id
 * @access  Private
 */
exports.getInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOne({
      _id: id,
      companyName: req.companyName // ✅ Filter by company
    }).populate('quotationId', 'quotationNumber status description');

    if (!invoice) {
      return ApiResponse.error(res, 'Invoice not found', 404);
    }

    return ApiResponse.success(res, 'Invoice fetched successfully', invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    return ApiResponse.error(res, 'Server error fetching invoice', 500);
  }
};

/**
 * @desc    Update invoice payment
 * @route   PATCH /api/invoices/:id/payment
 * @access  Private
 */
exports.updateInvoicePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaid, notes } = req.body;

    const invoice = await Invoice.findOne({
      _id: id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!invoice) {
      return ApiResponse.error(res, 'Invoice not found', 404);
    }

    if (invoice.status === 'cancelled') {
      return ApiResponse.error(res, 'Cannot update payment for cancelled invoice', 400);
    }

    // Store old values
    const oldAmountPaid = invoice.amountPaid;
    const oldPaymentStatus = invoice.paymentStatus;

    // Update payment with validation
    if (amountPaid !== undefined) {
      if (amountPaid < 0) {
        return ApiResponse.error(res, 'Payment amount cannot be negative', 400);
      }
      
      if (amountPaid > invoice.finalTotal) {
        return ApiResponse.error(res, `Payment amount (₦${amountPaid.toLocaleString()}) cannot exceed invoice total (₦${invoice.finalTotal.toLocaleString()})`, 400);
      }
      
      invoice.amountPaid = amountPaid;
    }

    if (notes !== undefined) {
      invoice.notes = notes;
    }

    await invoice.save();

    // Get current user
    const currentUser = await User.findById(req.user._id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'invoice_updated',
      title: 'Invoice Payment Updated',
      message: `${currentUser.fullname} updated payment for invoice ${invoice.invoiceNumber}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        oldAmountPaid: oldAmountPaid.toFixed(2),
        newAmountPaid: invoice.amountPaid.toFixed(2),
        balance: invoice.balance.toFixed(2),
        oldPaymentStatus,
        newPaymentStatus: invoice.paymentStatus
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Invoice payment updated successfully', invoice);
  } catch (error) {
    console.error('Update invoice payment error:', error);
    return ApiResponse.error(res, 'Server error updating invoice payment', 500);
  }
};

/**
 * @desc    Update invoice status
 * @route   PATCH /api/invoices/:id/status
 * @access  Private
 */
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'paid', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return ApiResponse.error(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const invoice = await Invoice.findOne({
      _id: id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!invoice) {
      return ApiResponse.error(res, 'Invoice not found', 404);
    }

    // Store old status
    const oldStatus = invoice.status;

    invoice.status = status;
    await invoice.save();

    // Get current user
    const currentUser = await User.findById(req.user._id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'invoice_updated',
      title: 'Invoice Status Updated',
      message: `${currentUser.fullname} changed invoice ${invoice.invoiceNumber} status to ${status}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        oldStatus,
        newStatus: status
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Invoice status updated successfully', invoice);
  } catch (error) {
    console.error('Update invoice status error:', error);
    return ApiResponse.error(res, 'Server error updating invoice status', 500);
  }
};

/**
 * @desc    Delete invoice
 * @route   DELETE /api/invoices/:id
 * @access  Private
 */
exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOne({
      _id: id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!invoice) {
      return ApiResponse.error(res, 'Invoice not found', 404);
    }

    // Store info before deletion
    const invoiceNumber = invoice.invoiceNumber;
    const clientName = invoice.clientName;
    const finalTotal = invoice.finalTotal;

    await invoice.deleteOne();

    // Get current user
    const currentUser = await User.findById(req.user._id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'invoice_deleted',
      title: 'Invoice Deleted',
      message: `${currentUser.fullname} deleted invoice ${invoiceNumber} for ${clientName}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        invoiceNumber,
        clientName,
        finalTotal: finalTotal.toFixed(2)
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Invoice deleted successfully', { id });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return ApiResponse.error(res, 'Server error deleting invoice', 500);
  }
};

/**
 * @desc    Get invoice statistics
 * @route   GET /api/invoices/stats
 * @access  Private
 */
exports.getInvoiceStats = async (req, res) => {
  try {
    const stats = await Invoice.aggregate([
      { $match: { companyName: req.companyName } }, // ✅ Filter by company
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$finalTotal' },
          totalPaid: { $sum: '$amountPaid' },
          totalBalance: { $sum: '$balance' },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
          },
          unpaidCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0] }
          },
          partialCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'partial'] }, 1, 0] }
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          overdueCount: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalInvoices: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalBalance: 0,
      paidCount: 0,
      unpaidCount: 0,
      partialCount: 0,
      pendingCount: 0,
      overdueCount: 0
    };

    return ApiResponse.success(res, 'Invoice statistics fetched successfully', result);
  } catch (error) {
    console.error('Get invoice stats error:', error);
    return ApiResponse.error(res, 'Server error fetching invoice statistics', 500);
  }
};