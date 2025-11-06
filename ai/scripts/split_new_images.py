"""
分割新的高质量图片 - 左右等分
左边：原始切片图片
右边：效果图（标注）
"""
import cv2
import numpy as np
import os
from pathlib import Path

# 配置路径
INPUT_DIR = "/home/proview/Desktop/Coder/cancerapp/ai/demo/pictures"
OUTPUT_DIR = "/home/proview/Desktop/Coder/cancerapp/ai/demo/processed"
ORIGINAL_DIR = f"{OUTPUT_DIR}/original"
ANNOTATED_DIR = f"{OUTPUT_DIR}/annotated"

# 创建输出目录
os.makedirs(ORIGINAL_DIR, exist_ok=True)
os.makedirs(ANNOTATED_DIR, exist_ok=True)

def split_image(image_path, output_name):
    """分割图像为左右两部分"""
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"  ⚠ 无法读取: {image_path}")
        return False

    height, width = img.shape[:2]
    mid = width // 2

    # 尝试找到分隔线（灰色或白色的竖线）
    for x in range(mid - 100, mid + 100):
        if x < 0 or x >= width:
            continue
        col = img[:, x, :]
        # 检查是否为灰色或白色列
        if (np.all(col > 180) or (np.std(col) < 10 and np.mean(col) > 150)):
            mid = x
            break

    # 分割图像
    left_img = img[:, :mid]     # 原始图像
    right_img = img[:, mid+1:]  # 标注图像

    # 保存
    left_path = f"{ORIGINAL_DIR}/{output_name}.jpg"
    right_path = f"{ANNOTATED_DIR}/{output_name}.jpg"

    cv2.imwrite(left_path, left_img)
    cv2.imwrite(right_path, right_img)

    return True

def main():
    # 获取所有图片
    image_files = sorted(Path(INPUT_DIR).glob("*.jpeg")) + sorted(Path(INPUT_DIR).glob("*.jpg"))

    print("=" * 60)
    print(f"找到 {len(image_files)} 张图片")
    print("=" * 60)

    success_count = 0
    for i, img_path in enumerate(image_files, 1):
        output_name = f"image_{i:03d}"
        print(f"[{i}/{len(image_files)}] 处理 {img_path.name} -> {output_name}")

        if split_image(img_path, output_name):
            success_count += 1

    print("\n" + "=" * 60)
    print(f"分割完成！成功处理 {success_count}/{len(image_files)} 张图片")
    print(f"原始图像: {ORIGINAL_DIR}")
    print(f"标注图像: {ANNOTATED_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
