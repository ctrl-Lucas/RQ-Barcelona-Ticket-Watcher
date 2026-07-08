const VALID_PASSWORDS = [process.env.SIGNUP_PASSWORD, process.env.SIGNUP_PASSWORD_2].filter(Boolean);

function isValidPassword(password) {
  return typeof password === 'string' && VALID_PASSWORDS.includes(password);
}

module.exports = { isValidPassword };
