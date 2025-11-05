module.exports = async (req, res) => {
  res.json({ 
    message: 'API endpoint is working!',
    timestamp: new Date().toISOString()
  });
};

