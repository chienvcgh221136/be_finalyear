const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const ctl = require("../controllers/appointmentController");

router.get("/me", auth, ctl.myAppointments);
router.post("/:postId", auth, ctl.createAppointment);
router.patch("/:id", auth, ctl.updateStatus);
router.delete("/:id", auth, ctl.deleteAppointment);


module.exports = router;