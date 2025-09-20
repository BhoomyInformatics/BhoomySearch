const express = require("express");
const dashbord = require("../controllers/Admin/dashbordController");

router = express.Router();
router.get("/", dashbord.index);
router.get("/Sites", dashbord.sites);
module.exports = router;

