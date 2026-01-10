function errorHandler(err) {
    const errors = {
      email: "",
      password: "",
      ssn: "",
      general: "",
    };
  
    
    switch (err.code || err.message) {
      case "EMAIL_IN_USE":
        errors.email = "Email already in use";
        break;
  
      case "INVALID_EMAIL":
        errors.email = "Invalid email address";
        break;
  
      case "INVALID_CREDENTIALS":
        errors.password = "Invalid email or password";
        break;
    }
  
    
    if (err.code === 11000) {
      if (err.keyPattern?.email) {
        errors.email = "Email already registered";
      }
      if (err.keyPattern?.ssn) {
        errors.ssn = "SSN already registered";
      }
    }
  
   
    if (err.name === "ValidationError") {
      Object.values(err.errors).forEach(({ path, message }) => {
        if (errors[path] !== undefined) {
          errors[path] = message;
        } else {
          errors.general = message;
        }
      });
    }
  
    
    if (
      !errors.email &&
      !errors.password &&
      !errors.ssn &&
      !errors.general
    ) {
      errors.general = "Something went wrong. Please try again.";
    }
  
    return errors;
  }
  
  module.exports = { errorHandler };
  