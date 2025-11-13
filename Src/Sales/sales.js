
const ApiResponse = require('../../Utils/apiResponse');
const Quotation = require('../../Models/quotationModel');
const Order = require('../../Models/orderModel');
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




// Get comprehensive sales analytics
exports.getSalesAnalytics = async (req, res) => {
  try {
    const { 
      period = 'daily', // daily, weekly, monthly, yearly
      startDate,
      endDate 
    } = req.query;

    const userId = req.user._id;

    // Build date filter
    const dateFilter = { userId };
    if (startDate || endDate) {
      dateFilter.orderDate = {};
      if (startDate) dateFilter.orderDate.$gte = new Date(startDate);
      if (endDate) dateFilter.orderDate.$lte = new Date(endDate);
    } else {
      // Default to current period based on selection
      const now = new Date();
      let start;
      
      switch(period) {
        case 'daily':
          start = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'weekly':
          start = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'monthly':
          start = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'yearly':
          start = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
      }
      dateFilter.orderDate = { $gte: start };
    }

    // 1. Get Key Metrics (Revenue, Projects, Customers, Profit)
    const keyMetrics = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalProjects: { $sum: 1 },
          totalCost: { $sum: '$totalCost' },
          uniqueCustomers: { $addToSet: '$clientName' }
        }
      },
      {
        $project: {
          _id: 0,
          totalRevenue: 1,
          totalProjects: 1,
          totalCost: 1,
          customersCount: { $size: '$uniqueCustomers' },
          profit: { $subtract: ['$totalRevenue', '$totalCost'] },
          profitMargin: {
            $multiply: [
              { 
                $divide: [
                  { $subtract: ['$totalRevenue', '$totalCost'] },
                  '$totalRevenue'
                ]
              },
              100
            ]
          }
        }
      }
    ]);

    // Calculate percentage changes (compare with previous period)
    let previousPeriodFilter = { userId };
    if (dateFilter.orderDate) {
      const currentStart = dateFilter.orderDate.$gte;
      const currentEnd = dateFilter.orderDate.$lte || new Date();
      const periodLength = currentEnd - currentStart;
      
      previousPeriodFilter.orderDate = {
        $gte: new Date(currentStart - periodLength),
        $lt: currentStart
      };
    }

    const previousMetrics = await Order.aggregate([
      { $match: previousPeriodFilter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalProjects: { $sum: 1 }
        }
      }
    ]);

    const current = keyMetrics[0] || {
      totalRevenue: 0,
      totalProjects: 0,
      totalCost: 0,
      customersCount: 0,
      profit: 0,
      profitMargin: 0
    };

    const previous = previousMetrics[0] || {
      totalRevenue: 0,
      totalProjects: 0
    };

    const revenueChange = previous.totalRevenue > 0 
      ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100
      : 0;

    const projectsChange = previous.totalProjects > 0
      ? ((current.totalProjects - previous.totalProjects) / previous.totalProjects) * 100
      : 0;

    // Calculate average revenue per customer
    const avgRevenuePerCustomer = current.customersCount > 0
      ? current.totalRevenue / current.customersCount
      : 0;

    const metrics = {
      revenue: {
        total: current.totalRevenue,
        change: revenueChange
      },
      projects: {
        total: current.totalProjects,
        change: projectsChange
      },
      customers: {
        total: current.customersCount,
        avgRevenuePerCustomer: avgRevenuePerCustomer
      },
      profit: {
        total: current.profit,
        margin: current.profitMargin
      }
    };

    // 2. Sales Performance (Time-based)
    let groupByFormat;
    switch(period) {
      case 'daily':
        groupByFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        break;
      case 'weekly':
        groupByFormat = { $week: "$orderDate" };
        break;
      case 'monthly':
        groupByFormat = { $dateToString: { format: "%Y-%m", date: "$orderDate" } };
        break;
      case 'yearly':
        groupByFormat = { $year: "$orderDate" };
        break;
    }

    const salesPerformance = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: groupByFormat,
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          period: '$_id',
          revenue: 1,
          orders: 1
        }
      }
    ]);

    // 3. Project Types Distribution
    const projectTypes = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.woodType',
          count: { $sum: 1 },
          revenue: { $sum: '$items.sellingPrice' }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id',
          count: 1,
          revenue: 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Calculate percentages
    const totalProjectItems = projectTypes.reduce((sum, item) => sum + item.count, 0);
    const projectTypesWithPercentage = projectTypes.map(item => ({
      ...item,
      percentage: totalProjectItems > 0 ? (item.count / totalProjectItems) * 100 : 0
    }));

    // 4. Performance Summary
    const performanceSummary = {
      averageProjectValue: current.totalProjects > 0 
        ? current.totalRevenue / current.totalProjects 
        : 0,
      projectsPerCustomer: current.customersCount > 0
        ? current.totalProjects / current.customersCount
        : 0,
      revenuePerCustomer: avgRevenuePerCustomer
    };

    // 5. Payment Status Distribution
    const paymentDistribution = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          paidAmount: { $sum: '$amountPaid' }
        }
      },
      {
        $project: {
          _id: 0,
          status: '$_id',
          count: 1,
          totalAmount: 1,
          paidAmount: 1
        }
      }
    ]);

    // 6. Top Customers
    const topCustomers = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$clientName',
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          email: { $first: '$email' },
          phone: { $first: '$phoneNumber' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          name: '$_id',
          totalRevenue: 1,
          totalOrders: 1,
          email: 1,
          phone: 1
        }
      }
    ]);

    return ApiResponse.success(res, 'Sales analytics fetched successfully', {
      period,
      metrics,
      salesPerformance,
      projectTypes: projectTypesWithPercentage,
      performanceSummary,
      paymentDistribution,
      topCustomers
    });

  } catch (error) {
    console.error('Get sales analytics error:', error);
    return ApiResponse.error(res, 'Server error fetching sales analytics', 500);
  }
};

// Get inventory status from orders
exports.getInventoryStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    // This is a simplified version - you might want to connect to actual inventory
    const inventoryData = await Order.aggregate([
      { $match: { userId } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.woodType',
          totalUsed: { $sum: '$items.quantity' }
        }
      },
      {
        $project: {
          _id: 0,
          material: '$_id',
          used: '$totalUsed',
          // These would come from actual inventory system
          inStock: 435, // Placeholder
          lowStock: 150, // Placeholder
          outOfStock: 82 // Placeholder
        }
      }
    ]);

    return ApiResponse.success(res, 'Inventory status fetched successfully', inventoryData);

  } catch (error) {
    console.error('Get inventory status error:', error);
    return ApiResponse.error(res, 'Server error fetching inventory status', 500);
  }
};

