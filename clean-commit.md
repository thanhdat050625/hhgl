:: 1. Tạo một nhánh rỗng không kế thừa lịch sử cũ
git checkout --orphan temp_branch

:: 2. Thêm toàn bộ file hiện tại vào commit mới
git add -A
git commit -m "Initial commit"

:: 3. Xóa nhánh main cũ và đổi tên nhánh mới thành main
git branch -D main
git branch -m main

:: 4. Force push đè hoàn toàn lên remote
git push -f origin main