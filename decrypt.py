import sys
import hashlib
import os
import csv
import base64

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend
except ImportError:
    print("错误: 缺少 cryptography 库。")
    print("请在控制台运行以下命令安装所需依赖：")
    print("pip install cryptography")
    sys.exit(1)

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
        
        # Remove PKCS7 padding
        padding_len = decrypted[-1]
        if padding_len < 1 or padding_len > 16:
            raise ValueError("Invalid padding")
        ticket = decrypted[:-padding_len].decode('utf-8')
        
        return ticket
    except Exception as e:
        return f"ERROR:{str(e)}"

def load_student_database():
    database = {}
    csv_file = "students.csv"
    if not os.path.exists(csv_file):
        return None
    try:
        # Support utf-8-sig to automatically handle Excel BOM
        with open(csv_file, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            if not headers:
                return None
            
            # Map headers to standard fields
            ticket_col = None
            name_col = None
            school_col = None
            major_col = None
            
            for h in headers:
                h_clean = h.strip()
                if h_clean in ["准考证号", "准考证", "ticket", "id", "ID"]:
                    ticket_col = h
                elif h_clean in ["姓名", "name", "Name"]:
                    name_col = h
                elif h_clean in ["毕业学校", "school", "School", "毕业中学"]:
                    school_col = h
                elif h_clean in ["录取专业", "major", "Major", "专业"]:
                    major_col = h
            
            # Fallback mappings if headers don't match standard names
            if not ticket_col:
                ticket_col = headers[0]
            if not name_col and len(headers) > 1:
                name_col = headers[1]
                
            for row in reader:
                ticket = row.get(ticket_col)
                if ticket:
                    database[ticket.strip()] = {
                        "name": row.get(name_col, "未知").strip() if name_col else "未知",
                        "school": row.get(school_col, "未知").strip() if school_col else "未知",
                        "major": row.get(major_col, "未知").strip() if major_col else "未知",
                    }
        return database
    except Exception as e:
        print(f"警告: 读取 students.csv 时发生错误 ({str(e)})")
        return None

def main():
    # Attempt to load secret key from environment variable
    secret_key = os.environ.get("ENCRYPTION_KEY")
    if not secret_key:
        print("提示: 未检测到环境变量 ENCRYPTION_KEY。")
        secret_key = input("请输入解密秘钥 (Secret Key): ").strip()
        if not secret_key:
            print("错误: 秘钥不能为空。")
            sys.exit(1)
            
    student_db = load_student_database()
    if student_db is None:
        print("提示: 未检测到本地 students.csv 录取名单文件。解密后将仅显示准考证号。")
        print("可以在脚本同目录下放一个 students.csv（包含'准考证号'、'姓名'等列），即可自动显示姓名。")
    else:
        print(f"成功加载录取名单：共读取到 {len(student_db)} 条学生记录。")

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
            
        ticket = decrypt_code(code, secret_key)
        
        print("\n------------------------------------------")
        if ticket.startswith("ERROR:"):
            print(f"❌ 解密失败！")
            print(f"原因: 请确认校验码输入完整，或解密秘钥是否与线上系统一致。")
            # print(f"调试信息: {ticket}")
        else:
            print(f"✅ 解密成功！")
            print(f" 🆔 解密出准考证号: {ticket}")
            
            if student_db:
                student = student_db.get(ticket)
                if student:
                    print(f" 🎉 录取名单匹配成功！学生信息如下：")
                    print(f"    👤 考生姓名: {student['name']}")
                    print(f"    🎓 毕业学校: {student['school']}")
                    print(f"    🔬 录取专业: {student['major']}")
                else:
                    print(f" ⚠️  注意：此准考证号在当前的 students.csv 录取名单中未找到记录。")
            else:
                print(" 💡 可以在本地配好 students.csv 后再次查询以关联学生姓名。")
        print("------------------------------------------")

if __name__ == "__main__":
    main()
