
def username_check(v: str) -> str:
    if len(v) < 3 or len(v) > 30:
        raise ValueError("Kullanıcı adı 3 ile 30 karakter arasında olmalıdır")
    
    # Turkish character mapping
    turkish_map = {
        'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U',
        'ş': 's', 'Ş': 'S',
        'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O',
        'ç': 'c', 'Ç': 'C'
    }
    
    # Convert Turkish characters to ASCII equivalents
    normalized = ''.join(turkish_map.get(char, char) for char in v)
    
    # Check if contains only allowed characters
    if not normalized.isalnum():
        raise ValueError("Kullanıcı adı sadece harf ve rakamlardan oluşabilir")
    
    # Check if original had Turkish characters
    if v != normalized:
        raise ValueError("Kullanıcı adı türkçe karakter içeremez (ü,ğ,ş,ı,ö,ç)")
    
    return v

def password_check(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Şifre en az 8 karakter olmalıdır")
    
    # Check complexity
    has_upper = any(char.isupper() for char in v)
    has_lower = any(char.islower() for char in v)
    has_digit = any(char.isdigit() for char in v)
    has_special = any(not char.isalnum() for char in v)
    
    complexity_score = sum([has_upper, has_lower, has_digit, has_special])
    if complexity_score < 3:
        raise ValueError("Şifre yeterince karmaşık değil")
    
    # Check against common passwords
    common_passwords = [
        'password', '123456', '12345678', '1234', 'qwerty', '12345', 'abc123',
        'password1', 'admin', 'letmein', 'welcome', 'monkey', 'football', 'iloveyou'
    ]
    
    if v.lower() in common_passwords:
        raise ValueError("Şifre çok yaygın bir şifre, lütfen daha güçlü bir şifre seçin")
    
    return v