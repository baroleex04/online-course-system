function authorizeRole(allowedRoles) {
    return (req, res, next) => {
        const userType = req.session.user_type;

        if (!userType) {
            return res.redirect('/login');
        }

        if (!allowedRoles.includes(userType)) {
            return res.status(403).send('Access denied');
        }

        next();
    };
}

module.exports = authorizeRole;
