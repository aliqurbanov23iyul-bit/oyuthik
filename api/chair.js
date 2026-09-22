/**
 * /api/chair — deprecated, redirects to admin panel.
 * CHAIR users now use /admin.html with their permissions.
 */
module.exports = async (req, res) => {
  res.status(301).json({
    error: 'Bu endpoint artıq istifadə edilmir. Admin panelindən istifadə edin.',
    redirect: '/admin.html'
  });
};
