const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const role = require("../middlewares/roleMiddleware");
const reportController = require("../controllers/reportController");


router.get("/admin", auth, role("ADMIN"), reportController.getAllReports);
router.patch("/:id/resolve", auth, role("ADMIN"), reportController.resolveReport);
router.patch("/:id/reject", auth, role("ADMIN"), reportController.rejectReport);

router.post("/:postId", auth, reportController.createReport);
module.exports = router;
