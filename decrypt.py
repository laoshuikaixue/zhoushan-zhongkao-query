import sys
import hashlib
import os
import base64
import hmac

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend
except ImportError:
    print("错误: 缺少 cryptography 库。")
    print("请在控制台运行以下命令安装所需依赖：")
    print("pip install cryptography")
    sys.exit(1)

CJK_BASE = 0x4E00

def base64url_decode(value):
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + padding)

def hmac_digest(secret_key, *values):
    digest = hmac.new(secret_key.encode('utf-8'), digestmod=hashlib.sha256)
    for value in values:
        digest.update(value)
    return digest.digest()

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

def unpack_chinese_name(data, name_len):
    bits = int.from_bytes(data, byteorder="big")
    total_bits = len(data) * 8
    chars = []
    for index in range(name_len):
        shift = total_bits - 15 * (index + 1)
        value = (bits >> shift) & 0x7FFF
        chars.append(chr(CJK_BASE + value))
    return "".join(chars)

def decrypt_code(encrypted_str, secret_key):
    try:
        # 使用密钥的 SHA-256 摘要生成 32 字节 AES 密钥。
        key = hashlib.sha256(secret_key.encode('utf-8')).digest()

        compact_data = base64url_decode(encrypted_str)

        if len(compact_data) == 26:
            nonce = compact_data[:2]
            ciphertext = compact_data[2:]
            iv = hmac_digest(secret_key, b"admission-v4-iv", nonce)[:16]

            cipher = Cipher(algorithms.AES(key), modes.CTR(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            payload = decryptor.update(ciphertext) + decryptor.finalize()

            expected_nonce = hmac_digest(secret_key, b"admission-v4-nonce", payload)[:2]
            if not hmac.compare_digest(nonce, expected_nonce):
                raise ValueError("Invalid checksum")

            meta = payload[0]
            if meta >> 4 != 4:
                raise ValueError("Invalid compact format")
            name_len = meta & 0b111
            if name_len > 6:
                raise ValueError("Invalid name length")

            ticket_len = 14 if meta & 0b1000 else 13
            ticket = unpack_digits(payload[1:8])[-ticket_len:]
            birth_date = unpack_digits(payload[8:12])
            name = unpack_chinese_name(payload[12:24], name_len)

            return {
                "ok": True,
                "format": "v4",
                "ticket": ticket,
                "birth_date": birth_date,
                "name": name,
                "name_hash": None,
            }

        if len(compact_data) == 22:
            nonce = compact_data[:2]
            ciphertext = compact_data[2:]
            iv = hmac_digest(secret_key, b"admission-v3-iv", nonce)[:16]

            cipher = Cipher(algorithms.AES(key), modes.CTR(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            payload = decryptor.update(ciphertext) + decryptor.finalize()

            expected_nonce = hmac_digest(secret_key, b"admission-v3-nonce", payload)[:2]
            if not hmac.compare_digest(nonce, expected_nonce):
                raise ValueError("Invalid checksum")

            meta = payload[0]
            if meta >> 4 != 3:
                raise ValueError("Invalid compact format")
            name_len = meta & 0b111
            if name_len > 4:
                raise ValueError("Invalid name length")

            ticket_len = 14 if meta & 0b1000 else 13
            ticket = unpack_digits(payload[1:8])[-ticket_len:]
            birth_date = unpack_digits(payload[8:12])
            name = unpack_chinese_name(payload[12:20], name_len)

            return {
                "ok": True,
                "format": "v3",
                "ticket": ticket,
                "birth_date": birth_date,
                "name": name,
                "name_hash": None,
            }

        # 解码旧版 AES-ECB 载荷。
        ciphertext = base64.b64decode(encrypted_str)

        # 使用 AES-256-ECB 解密旧版校验码。
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
                "name": None,
                "name_hash": name_hash,
            }
        
        # 旧版格式：去掉 PKCS7 填充，仅返回准考证号。
        padding_len = decrypted[-1]
        if padding_len < 1 or padding_len > 16:
            raise ValueError("Invalid padding")
        ticket = decrypted[:-padding_len].decode('utf-8')
        
        return {
            "ok": True,
            "format": "legacy",
            "ticket": ticket,
            "birth_date": None,
            "name": None,
            "name_hash": None,
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
        }

def main():
    # 优先从环境变量读取密钥。
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
    print(f"当前加密方式: AES-256-CTR 紧凑码 / AES-256-ECB 兼容")
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
        else:
            print(f"[成功] 解密成功！")
            if result.get("name"):
                print(f"考生姓名: {result['name']}")
            elif result.get("name_hash"):
                print(f"姓名核验指纹: {result['name_hash']}")
            ticket = result["ticket"]
            birth_date = result.get("birth_date", "")
            if birth_date:
                print(f"{ticket} {birth_date}")
            else:
                print(ticket)
            if result["format"] == "legacy":
                print("[注意] 这是旧版校验码，仅包含准考证号。")
        print("------------------------------------------")

if __name__ == "__main__":
    main()
