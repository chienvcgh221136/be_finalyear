const router=require("express").Router();
const auth=require("../middlewares/authMiddleware");
const ctl=require("../controllers/favoriteController");


router.get("/me",auth,ctl.myFavorites);
router.post("/:postId",auth,ctl.toggleFavorite);

module.exports=router;