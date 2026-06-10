import pytest
import sys
import os

# Thêm đường dẫn thư mục hiện tại để có thể import main.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import get_password_hash, verify_password, SECRET_KEY, ALGORITHM

def test_password_hashing():
    """Kiểm tra chức năng mã hóa và giải mã mật khẩu bằng bcrypt."""
    password = "my_secure_password"
    hashed = get_password_hash(password)
    
    # Đảm bảo mật khẩu đã được mã hóa, không phải là dạng plain text
    assert hashed != password
    assert len(hashed) > 0
    
    # Kiểm tra xác thực đúng mật khẩu
    assert verify_password(password, hashed) is True
    
    # Kiểm tra xác thực sai mật khẩu
    assert verify_password("wrong_password", hashed) is False

def test_security_config():
    """Kiểm tra cấu hình bảo mật cơ bản."""
    assert SECRET_KEY is not None
    assert len(SECRET_KEY) > 10, "SECRET_KEY nên đủ dài để đảm bảo an toàn"
    assert ALGORITHM == "HS256"
