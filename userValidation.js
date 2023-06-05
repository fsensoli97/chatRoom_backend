const joi = require('joi');

function userValidation(user) {
    const joiSchema = joi.object({
        username: joi.string().min(4).max(20).required(),
        password: joi.string().min(8).max(15).required()
    })

    return joiSchema.validate(user);
}

module.exports = {userValidation: userValidation};