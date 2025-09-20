const express = require("express");
const SiteController = require("../controllers/Apis/SiteController");

const router = express.Router();

// =====================================================
// MODERN SEARCH API ENDPOINTS
// =====================================================

// Main search endpoint with filters support
router.get("/search", SiteController.search);
router.post("/search", SiteController.search);

// Specialized search endpoints
router.get("/search/images", SiteController.get_images);
router.post("/search/images", SiteController.get_images);

router.get("/search/videos", SiteController.get_videos);
router.post("/search/videos", SiteController.get_videos);

router.get("/search/news", SiteController.get_news);
router.post("/search/news", SiteController.get_news);

// Search suggestions and autocomplete
router.get("/search/suggestions", SiteController.get_suggestions);
router.post("/search/suggestions", SiteController.get_suggestions);

// Search aggregations for filters
router.get("/search/aggregations", SiteController.get_aggregations);

// Health check endpoint
router.get("/health", SiteController.health_check);

module.exports = router;