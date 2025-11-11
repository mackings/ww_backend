
const ApiResponse = require('../../Utils/apiResponse');
const Quotation = require('../../Models/quotationModel');
console.log('Quotation:', Quotation);
console.log('Type:', typeof Quotation);
console.log('Is function?', typeof Quotation.find);



exports.getClients = async (req, res) => {
  try {
    // Find all quotations belonging to the logged-in user
    const quotations = await Quotation.find({ userId: req.user._id })

      .select('clientName phoneNumber email clientAddress nearestBusStop')
      .lean();

    if (!quotations.length) {
      return ApiResponse.success(res, 'No clients found', []);
    }

    // Extract unique clients by name and/or phone/email
    const uniqueClients = [];
    const seen = new Set();

    quotations.forEach(q => {
      const key = `${q.clientName}-${q.phoneNumber || q.email}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueClients.push({
          clientName: q.clientName,
          phoneNumber: q.phoneNumber || null,
          email: q.email || null,
          clientAddress: q.clientAddress || null,
          nearestBusStop: q.nearestBusStop || null,
        });
      }
    });

    return ApiResponse.success(res, 'Clients fetched successfully', uniqueClients);
  } catch (error) {
    console.error('Get clients error:', error);
    return ApiResponse.error(res, 'Server error fetching clients', 500);
  }
};