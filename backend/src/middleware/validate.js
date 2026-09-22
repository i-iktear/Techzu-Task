// wraps a zod schema into express middleware, validating req.body
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'validation_error',
        details: result.error.flatten(),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
