const express = require("express");
const { createOverheadCost, getOverheadCosts, deleteOverheadCost } = require("../Src/OverheadCost/oc");
const { protect } = require("../Utils/auth");
const  {getActiveCompany} = require('../Utils/ActiveCompany');

const router = express.Router();

router.use(protect);
router.use(getActiveCompany);

router.post("/create-oc", protect, createOverheadCost);
router.get("/get-oc", protect, getOverheadCosts);
router.delete("/delete-oc/:id", protect, deleteOverheadCost);


module.exports = router;


