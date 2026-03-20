module.exports = {
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
  plans: {
    free: { name: "Free", price: 0, containers: 0, ram: "0", cpu: 0 },
    starter: { name: "Starter", price: 10000, containers: 1, ram: "512m", cpu: 0.5 },
    pro: { name: "Pro", price: 20000, containers: 3, ram: "1g", cpu: 1 },
    business: { name: "Business", price: 50000, containers: 10, ram: "2g", cpu: 2 },
  },
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: "7d",
  port: process.env.PORT || 4000,
  docker: {
    portRange: { min: 3000, max: 9000 },
  },
};

