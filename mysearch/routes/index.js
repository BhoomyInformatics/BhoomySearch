const express = require("express");
const search = require("../controllers/rootController");

router = express.Router();

// Only keep the go route for URL redirection (this doesn't use templates)
router.get("/go", search.go);

// All other routes should be handled by React frontend
// Remove template-based routes that cause view engine errors:
// router.get("/", search.index);           // Now handled by React
// router.get("/search", search.search);    // Now handled by React
// router.get("/About-us", search.about);   // Now handled by React
// router.get("/images", search.image_search);  // Now handled by React
// router.get("/videos", search.videos_search); // Now handled by React
// router.get("/news", search.news_search);     // Now handled by React
// router.get("/login", search.login);          // Now handled by React
// router.post("/login", search.login_post);    // Now handled by React

module.exports = router;