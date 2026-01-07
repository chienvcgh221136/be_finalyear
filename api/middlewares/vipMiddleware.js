module.exports = (req,res,next)=>{
  const user=req.user;
  if (user.role==="ADMIN") return next();
  if (user.vip?.isActive && user.vip.expiredAt>new Date()) return next();
  return res.status(403).json({ success:false, message:"VIP required" });
};
