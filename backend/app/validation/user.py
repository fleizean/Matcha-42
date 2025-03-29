import re
from unidecode import unidecode

def validate_username(username):
    if not username:
        return False, "Kullanıcı adı gereklidir"
    
    if len(username) < 3 or len(username) > 30:
        return False, "Kullanıcı adı 3 ile 30 karakter arasında olmalıdır"
    
    # Convert Turkish characters to ASCII equivalents
    normalized = unidecode(username)
    
    # Check if contains only allowed characters
    if not normalized.isalnum():
        return False, "Kullanıcı adı sadece harf ve rakamlardan oluşabilir"
    
    # Check if original had Turkish characters
    if username != normalized:
        return False, "Kullanıcı adı türkçe karakter içeremez (ü,ğ,ş,ı,ö,ç)"
    
    return True, ""

def validate_email(email):
    if not email:
        return False, "Mail adresi gereklidir"
    
    # Simple email validation regex
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        return False, "Mail adresi geçersiz"
    
    return True, ""

def validate_password(password):
    if not password:
        return False, "Şifre gereklidir"
    
    if len(password) < 8:
        return False, "Şifre en az 8 karakter olmalıdır"
    
    # Check complexity
    has_upper = any(char.isupper() for char in password)
    has_lower = any(char.islower() for char in password)
    has_digit = any(char.isdigit() for char in password)
    has_special = any(not char.isalnum() for char in password)
    
    complexity_score = sum([has_upper, has_lower, has_digit, has_special])
    if complexity_score < 3:
        return False, "Şifre yeterince karmaşık değil"
    
    # Check against common passwords
    common_passwords = [
        'password', '123456', '12345678', '1234', 'qwerty', '12345', 'abc123',
        'password1', 'admin', 'letmein', 'welcome', 'monkey', 'football', 'iloveyou'
    ]
    
    if password.lower() in common_passwords:
        return False, "Şifre çok yaygın bir şifre, lütfen daha güçlü bir şifre seçin"
    
    return True, ""

def validate_name(name, field_name="Name"):
    if not name:
        return False, f"{field_name} şifre gereklidir"
    
    if len(name) < 1 or len(name) > 50:
        return False, f"{field_name} 1 ile 50 karakter arasında olmalıdır"
    
    return True, ""

def validate_user_create(data):
    errors = {}
    
    # Validate username
    is_valid, msg = validate_username(data.get("username"))
    if not is_valid:
        errors["username"] = msg
    
    # Validate email
    is_valid, msg = validate_email(data.get("email"))
    if not is_valid:
        errors["email"] = msg
    
    # Validate password
    is_valid, msg = validate_password(data.get("password"))
    if not is_valid:
        errors["password"] = msg
    
    # Validate first name
    is_valid, msg = validate_name(data.get("first_name"), "First name")
    if not is_valid:
        errors["first_name"] = msg
    
    # Validate last name
    is_valid, msg = validate_name(data.get("last_name"), "Last name")
    if not is_valid:
        errors["last_name"] = msg
    
    return len(errors) == 0, errors

def validate_user_update(data):
    errors = {}
    
    # Validate username if provided
    if "username" in data:
        is_valid, msg = validate_username(data.get("username"))
        if not is_valid:
            errors["username"] = msg
    
    # Validate email if provided
    if "email" in data:
        is_valid, msg = validate_email(data.get("email"))
        if not is_valid:
            errors["email"] = msg
    
    # Validate first name if provided
    if "first_name" in data:
        is_valid, msg = validate_name(data.get("first_name"), "First name")
        if not is_valid:
            errors["first_name"] = msg
    
    # Validate last name if provided
    if "last_name" in data:
        is_valid, msg = validate_name(data.get("last_name"), "Last name")
        if not is_valid:
            errors["last_name"] = msg
    
    return len(errors) == 0, errors