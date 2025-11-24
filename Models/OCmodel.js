const mongoose = require("mongoose");

const overheadCostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    category: {
      type: String,
      enum: ["Depreciation", "Others", "Rent", "Salaries"],
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    period: {
      type: String,
      enum: ["Hourly", "Daily", "Weekly", "Monthly", "Yearly"],
      required: true,
    },

    cost: {
      type: Number,
      required: true,
      min: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.OverheadCost ||
  mongoose.model("OverheadCost", overheadCostSchema);
