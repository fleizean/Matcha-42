def validate_tag(tag):
    BLACKLISTED_TAGS = [
        'admin', 'moderator', 'staff', 'support',
        'system', 'crushit', 'crushitapp'
    ]
    
    # Check length
    if len(tag) < 2 or len(tag) > 20:
        return False, "Tag name must be between 2 and 20 characters"
    
    # Check characters - only allow letters, numbers, and hyphens
    if not tag.replace('-', '').isalnum():
        return False, "Tag can only contain letters, numbers, and hyphens"
    
    # Check for valid hyphen usage
    if tag.startswith('-') or tag.endswith('-'):
        return False, "Tag cannot start or end with a hyphen"
    
    # Check for consecutive hyphens
    if '--' in tag:
        return False, "Tag cannot contain consecutive hyphens"
    
    # Check blacklist
    if tag.lower() in BLACKLISTED_TAGS:
        return False, f"'{tag}' tag is not allowed"
    
    # Check if tag contains only hyphens
    if all(c == '-' for c in tag):
        return False, "Tag cannot consist only of hyphens"
    
    return True, ""

def validate_tags(tags):
    if not tags:
        return True, ""  # Tags are optional
    
    errors = []
    for tag in tags:
        is_valid, msg = validate_tag(tag)
        if not is_valid:
            errors.append(f"Tag '{tag}': {msg}")
    
    if errors:
        return False, errors
    
    return True, ""

