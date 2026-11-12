import os
import json
from PIL import Image

def main():
    mappings_file = 'scripts/all_image_mappings.json'
    with open(mappings_file, 'r', encoding='utf-8') as f:
        mappings = json.load(f)

    opt_dir = 'products_optimized'
    os.makedirs(opt_dir, exist_ok=True)

    total_orig_size = 0
    total_opt_size = 0
    success_count = 0

    print(f"Starting optimization of {len(mappings)} product images...")

    for orig_name, clean_name in mappings.items():
        src_path = os.path.join('products', orig_name)
        if not os.path.exists(src_path):
            print(f"Warning: source file not found: {src_path}")
            continue

        orig_size = os.path.getsize(src_path)
        total_orig_size += orig_size

        try:
            with Image.open(src_path) as im:
                # Convert color mode to RGB (handles RGBA, P, etc.)
                if im.mode in ('RGBA', 'P', 'LA'):
                    im = im.convert('RGB')
                elif im.mode != 'RGB':
                    im = im.convert('RGB')

                # Resize so max dimension is 1200px (retina-crisp for mobile)
                max_dim = 1200
                w, h = im.size
                if max(w, h) > max_dim:
                    if w > h:
                        new_w = max_dim
                        new_h = int(h * (max_dim / w))
                    else:
                        new_h = max_dim
                        new_w = int(w * (max_dim / h))
                    im = im.resize((new_w, new_h), Image.Resampling.LANCZOS)

                dest_path = os.path.join(opt_dir, clean_name)
                # Save as Progressive JPEG with quality 83
                im.save(dest_path, 'JPEG', quality=83, optimize=True, progressive=True)

                opt_size = os.path.getsize(dest_path)
                total_opt_size += opt_size
                success_count += 1
                ratio = round((1 - opt_size / orig_size) * 100, 1)
                print(f"[{success_count}/{len(mappings)}] {orig_name} -> {clean_name} | {orig_size//1024}KB -> {opt_size//1024}KB (-{ratio}%)")

        except Exception as e:
            print(f"Error processing {orig_name}: {e}")

    orig_mb = round(total_orig_size / (1024 * 1024), 2)
    opt_mb = round(total_opt_size / (1024 * 1024), 2)
    overall_reduction = round((1 - total_opt_size / total_orig_size) * 100, 1)

    print("\n==========================================")
    print(f"Successfully optimized: {success_count} images")
    print(f"Original total size:   {orig_mb} MB")
    print(f"Optimized total size:  {opt_mb} MB")
    print(f"Total Bandwidth Saved: {round(orig_mb - opt_mb, 2)} MB (-{overall_reduction}%)")
    print("==========================================")

if __name__ == '__main__':
    main()

