const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate an invoice PDF and save to filePath
 * @param {Object} invoice - Invoice document from MongoDB
 * @param {string} filePath - Destination path for the PDF (optional, auto-generated if not provided)
 * @returns {Promise<string>} - Resolves with file path after writing
 */
async function generateInvoicePDF(invoice, filePath) {
  return new Promise((resolve, reject) => {
    try {
      // ✅ Use /tmp directory for serverless environments (Vercel, AWS Lambda, etc.)
      // If no filePath provided, generate one in /tmp
      let outputPath = filePath;
      
      if (!outputPath) {
        const fileName = `invoice-${invoice.invoiceNumber || Date.now()}.pdf`;
        outputPath = path.join('/tmp', fileName);
      } else {
        // Ensure the path uses /tmp for serverless
        if (!outputPath.startsWith('/tmp')) {
          const fileName = path.basename(outputPath);
          outputPath = path.join('/tmp', fileName);
        }
      }

      // ✅ Ensure /tmp directory exists (it should by default in serverless)
      const tmpDir = path.dirname(outputPath);
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
        console.log('📁 tmp directory created at:', tmpDir);
      }

      console.log('📄 Generating PDF at:', outputPath);

      const doc = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(outputPath);

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
        .text(`Invoice Number: ${invoice.invoiceNumber || invoice.quotationNumber}`)
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
        .text(`Email: ${invoice.email || 'N/A'}`)
        .text(`Phone: ${invoice.phoneNumber || 'N/A'}`)
        .text(`Address: ${invoice.clientAddress || 'N/A'}`)
        .text(`Nearest Bus Stop: ${invoice.nearestBusStop || 'N/A'}`)
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
          const name = item.woodType || item.foamType || item.description || 'Item';
          const quantity = item.quantity || 1;
          const price = item.sellingPrice || item.costPrice || 0;
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
      // SERVICE (if any)
      // ---------------------------
      if (invoice.service && invoice.service.product) {
        doc
          .fontSize(12)
          .fillColor('#333333')
          .text(`Service: ${invoice.service.product} - ₦${invoice.service.totalPrice?.toLocaleString() || 0}`);
        doc.moveDown();
      }

      // ---------------------------
      // SUMMARY
      // ---------------------------
      doc
        .fontSize(12)
        .fillColor('#333333')
        .text(`Subtotal: ₦${(invoice.totalSellingPrice || 0).toLocaleString()}`)
        .text(`Discount (${invoice.discount || 0}%): -₦${(invoice.discountAmount || 0).toLocaleString()}`)
        .text(`Amount Paid: ₦${(invoice.amountPaid || 0).toLocaleString()}`)
        .text(`Balance: ₦${(invoice.balance || 0).toLocaleString()}`)
        .moveDown(0.5);

      doc
        .fontSize(14)
        .fillColor('#000000')
        .text(`Grand Total: ₦${(invoice.finalTotal || 0).toLocaleString()}`, { align: 'right' })
        .moveDown(1.5);

      // ---------------------------
      // PAYMENT STATUS
      // ---------------------------
      const statusColor = invoice.paymentStatus === 'paid' ? '#28a745' : '#dc3545';
      doc
        .fontSize(12)
        .fillColor(statusColor)
        .text(`Payment Status: ${(invoice.paymentStatus || 'unpaid').toUpperCase()}`, { align: 'center' })
        .moveDown(1);

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

      stream.on('finish', () => {
        console.log('✅ PDF generated successfully at:', outputPath);
        resolve(outputPath);
      });
      
      stream.on('error', (err) => {
        console.error('❌ PDF generation error:', err);
        reject(err);
      });
    } catch (err) {
      console.error('❌ PDF generation error:', err);
      reject(err);
    }
  });
}

module.exports = generateInvoicePDF;