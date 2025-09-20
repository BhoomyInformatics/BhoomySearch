const searchModel = require("../../models/searchModel");
const { con } = require("../../mysql");

const index = async(req, res) => {
    try {
        res.json({
            success: true,
            data: {
                message: "Admin dashboard - please use React frontend at /administrator",
                search: req.query.q || "",
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Admin dashboard error",
            timestamp: new Date().toISOString()
        });
    }
};

const sites = async(req, res) => {
    try {
        res.json({
            success: true,
            data: {
                message: "Sites management - please use React frontend at /administrator",
                search: req.query.q || "",
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Sites management error",
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = {
    index,
    sites
}