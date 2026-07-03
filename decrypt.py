import sys
import hashlib
import os
import base64

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend
except ImportError:
    print("错误: 缺少 cryptography 库。")
    print("请在控制台运行以下命令安装所需依赖：")
    print("pip install cryptography")
    sys.exit(1)

def unpack_digits(data):
    digits = []
    for byte in data:
        high = byte >> 4
        low = byte & 0x0F
        if high > 9 or low > 9:
            raise ValueError("Invalid BCD digit")
        digits.append(str(high))
        digits.append(str(low))
    return "".join(digits)

def decrypt_code(encrypted_str, secret_key):
    try:
        # Generate 32-byte key using SHA-256
        key = hashlib.sha256(secret_key.encode('utf-8')).digest()
        
        # Base64 decode
        ciphertext = base64.b64decode(encrypted_str)
        
        # Decrypt using AES-256-ECB
        cipher = Cipher(algorithms.AES(key), modes.ECB(), backend=default_backend())
        decryptor = cipher.decryptor()
        decrypted = decryptor.update(ciphertext) + decryptor.finalize()

        if len(decrypted) == 16 and decrypted[0] == 1:
            ticket_len = decrypted[1]
            if ticket_len not in (13, 14):
                raise ValueError("Invalid ticket length")
            ticket = unpack_digits(decrypted[2:9])[-ticket_len:]
            birth_date = unpack_digits(decrypted[9:13])
            name_hash = decrypted[13:16].hex().upper()

            return {
                "ok": True,
                "format": "v2",
                "ticket": ticket,
                "birth_date": birth_date,
                "name_hash": name_hash,
            }
        
        # Legacy format: remove PKCS7 padding and return ticket only.
        padding_len = decrypted[-1]
        if padding_len < 1 or padding_len > 16:
            raise ValueError("Invalid padding")
        ticket = decrypted[:-padding_len].decode('utf-8')
        
        return {
            "ok": True,
            "format": "legacy",
            "ticket": ticket,
            "birth_date": None,
            "name_hash": None,
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
        }

def main():
    # Attempt to load secret key from environment variable
    secret_key = os.environ.get("ENCRYPTION_KEY")
    if not secret_key:
        print("提示: 未检测到环境变量 ENCRYPTION_KEY。")
        secret_key = input("请输入解密秘钥 (Secret Key): ").strip()
        if not secret_key:
            print("错误: 秘钥不能为空。")
            sys.exit(1)

    print("\n==========================================")
    print("      舟山市六横中学录取身份核验工具      ")
    print("==========================================")
    print(f"当前加密方式: AES-256-ECB (Base64)")
    print(f"当前秘钥前缀: {secret_key[:3]}***")
    
    while True:
        code = input("\n请输入入群校验码 (输入 q 退出): ").strip()
        if code.lower() == 'q':
            break
        if not code:
            continue
            
        result = decrypt_code(code, secret_key)
        
        print("\n------------------------------------------")
        if not result["ok"]:
            print(f"[失败] 解密失败！")
            print(f"原因: 请确认校验码输入完整，或解密秘钥是否与线上系统一致。")
            # print(f"调试信息: {result['error']}")
        else:
            ticket = result["ticket"]
            print(f"[成功] 解密成功！")
            print(f"解密出准考证号: {ticket}")
            if result["format"] == "v2":
                print(f"解密出出生年月日: {result['birth_date']}")
                print(f"姓名核验指纹: {result['name_hash']}")
            else:
                print("[注意] 这是旧版校验码，仅包含准考证号。")
        print("------------------------------------------")

if __name__ == "__main__":
    main()
