function errorHandler(err) {
    let errors = { email: "", password: "", database: "" }

    
    if (err.message === "Email already in use") {
        errors.email = "Email already in use"
    }

    if (err.message === "Invalid email address") {
        errors.email = "Incorrect email address"
    }

    
    if (err.message === "Invalid password") {
        errors.password = "You have entered a wrong password"
    }

    
    if (err.code === 11000) {
        if (err.keyPattern?.email) {
            errors.email = "Email already registered"
        }
        if (err.keyPattern?.ssn) {
            errors.database = "SSN already registered"
        }
    }

    
    if (err.name === "ValidationError") {
        Object.values(err.errors).forEach(({ path, message }) => {
            if (errors[path] !== undefined) {
                errors[path] = message
            } else {
                errors.database = message
            }
        })
    }

    return errors
}

module.exports = { errorHandler }
