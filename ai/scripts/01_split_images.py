"""
裁剪对比图：分离原始图像和标注图像
"""
import cv2
import os
from pathlib import Path
import numpy as np

# 路径配置
SOURCE_DIR = "/home/proview/Desktop/Coder/cancerapp/ai/demo/photo"
OUTPUT_DIR = "/home/proview/Desktop/Coder/cancerapp/ai/demo/processed"
ORIGINAL_DIR = os.path.join(OUTPUT_DIR, "original")
ANNOTATED_DIR = os.path.join(OUTPUT_DIR, "annotated")

# 创建输出目录
os.makedirs(ORIGINAL_DIR, exist_ok=True)
os.makedirs(ANNOTATED_DIR, exist_ok=True)

def split_image(image_path, output_name):
    """
    分离左右两部分图像

    Args:
        image_path: 输入图像路径
        output_name: 输出文件名（不含扩展名）
    """
    # 读取图像
    img = cv2.imread(image_path)
    if img is None:
        print(f"警告: 无法读取 {image_path}")
        return False

    height, width = img.shape[:2]

    # 找到中间分隔线（灰色竖线）
    # 通常在图像中心附近
    mid = width // 2

    # 在中心附近寻找灰色竖线
    search_range = 50  # 搜索范围
    for x in range(mid - search_range, mid + search_range):
        # 检查这一列是否是灰色竖线
        col = img[:, x, :]
        # 灰色线的RGB值应该接近 (200, 200, 200)
        if np.all(np.abs(col - 200) < 30, axis=1).sum() > height * 0.5:
            mid = x
            break

    # 分离左右两部分
    left_img = img[:, :mid]
    right_img = img[:, mid+1:]  # 跳过分隔线

    # 保存
    original_path = os.path.join(ORIGINAL_DIR, f"{output_name}.jpg")
    annotated_path = os.path.join(ANNOTATED_DIR, f"{output_name}.jpg")

    cv2.imwrite(original_path, left_img)
    cv2.imwrite(annotated_path, right_img)

    return True

def main():
    # 获取所有图像文件
    image_files = sorted(Path(SOURCE_DIR).glob("*.jpeg"))

    print(f"找到 {len(image_files)} 张图像")
    print("开始裁剪...")

    success_count = 0
    for i, image_path in enumerate(image_files, 1):
        # 生成统一的文件名：sample_001.jpg, sample_002.jpg, ...
        output_name = f"sample_{i:03d}"

        if split_image(str(image_path), output_name):
            success_count += 1
            if i % 20 == 0:
                print(f"处理进度: {i}/{len(image_files)}")

    print(f"\n完成！")
    print(f"成功处理: {success_count}/{len(image_files)}")
    print(f"原始图像保存到: {ORIGINAL_DIR}")
    print(f"标注图像保存到: {ANNOTATED_DIR}")

if __name__ == "__main__":
    main()
