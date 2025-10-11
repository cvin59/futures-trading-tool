# Position Trading System - Hướng Dẫn Sử Dụng

## Tổng Quan

Hệ thống Position Trading được thiết kế để theo dõi và quản lý các khoản đầu tư dài hạn với chiến lược DCA (Dollar Cost Averaging) và Take Profit có kế hoạch.

## Các Tính Năng Chính

### 1. 📊 Dashboard - Tổng Quan
- **Tổng vốn ban đầu**: Vốn khởi điểm của bạn
- **Giá trị hiện tại**: Tổng giá trị portfolio hiện tại
- **Tổng P&L**: Lãi/lỗ tổng thể ($ và %)
- **Tiền mặt còn**: Số tiền còn lại để đầu tư
- **Phân bổ Portfolio**: Biểu đồ hiển thị % từng tài sản
- **Top Holdings**: 5 tài sản có giá trị cao nhất

### 2. 📝 Trade Log - Nhật Ký Giao Dịch
- **Thêm giao dịch**: BUY/SELL/DCA với đầy đủ thông tin
- **Lọc và sắp xếp**: Theo ngày, ticker, hành động
- **Chỉnh sửa**: Có thể sửa đổi giao dịch đã nhập
- **Export CSV**: Xuất dữ liệu để phân tích ngoài
- **Tóm tắt thống kê**: Tổng mua, bán, net flow

#### Cách Thêm Giao Dịch:
1. Click nút "Add Trade"
2. Nhập thông tin:
   - **Ticker**: Mã tài sản (VD: BTC, ETH)
   - **Action**: BUY/SELL/DCA
   - **Price**: Giá thực hiện ($)
   - **Quantity**: Số lượng
   - **Fees**: Phí giao dịch ($)
   - **Notes**: Ghi chú lý do mua/bán
3. Click "Add" để lưu

### 3. 💼 Portfolio - Tổng Quan Tài Sản
- **Danh sách tài sản**: Tất cả tài sản đang nắm giữ
- **Cập nhật giá**: Nhập giá thị trường hiện tại
- **Tính toán tự động**: 
  - Giá mua trung bình
  - P&L thực tế
  - % portfolio
  - Trạng thái lãi/lỗ
- **Cảnh báo rebalance**: Khi tài sản >40% portfolio

#### Cách Cập Nhật Giá:
1. Trong cột "Cập nhật giá", nhập giá mới
2. Click "Update" hoặc nhấn Enter
3. Hệ thống tự động tính lại P&L và các chỉ số

### 4. 🎯 Take Profit Plan - Kế Hoạch Chốt Lời
Hệ thống tự động tạo 4 mức Take Profit cho mỗi tài sản:

#### Chiến Lược Take Profit:
- **TP1 @ +50%**: Chốt 20% holdings
- **TP2 @ +100%**: Chốt 20% holdings  
- **TP3 @ +200%**: Chốt 20% holdings
- **TP4 @ +300%**: Chốt 20% holdings
- **Hold**: Giữ 20% forever

#### Tính Năng:
- **Progress bar**: Theo dõi tiến độ đến mỗi mức
- **Cảnh báo tự động**: Khi đạt target price
- **Checkbox**: Đánh dấu đã chốt
- **Chỉnh sửa**: Tùy chỉnh target price và % chốt
- **Tóm tắt**: Tổng quan về plan cho từng tài sản

### 5. 📉 DCA Plan - Kế Hoạch Mua Bổ Sung
*(Sẽ được phát triển trong phiên bản tiếp theo)*

Hệ thống sẽ tự động tạo các mức DCA:
- **DCA1 @ -10%**: 15% vốn dự phòng
- **DCA2 @ -20%**: 20% vốn dự phòng
- **DCA3 @ -30%**: 25% vốn dự phòng
- **DCA4 @ -40%**: 40% vốn dự phòng

### 6. 🔔 Alerts - Hệ Thống Cảnh Báo
Tự động thông báo khi:
- ✅ **Đạt Take Profit**: Giá đạt target level
- ⚠️ **Vào vùng DCA**: Giá giảm về mức DCA
- 🔄 **Cần Rebalance**: Tài sản chiếm >40% portfolio
- 📈 **Lãi cao**: Đạt 50%, 100%, 200%
- 📉 **Lỗ cao**: Lỗ >20%

### 7. 📊 Performance - Hiệu Suất
*(Đang phát triển)*
- Win Rate (%)
- Total Trades
- Total ROI
- Best/Worst trades

## Quy Trình Sử Dụng

### Bước 1: Thiết Lập Ban Đầu
1. Truy cập tab "Position Trading"
2. Thêm giao dịch BUY đầu tiên
3. Hệ thống tự động tạo TP và DCA levels

### Bước 2: Theo Dõi Hàng Ngày
1. Cập nhật giá thị trường trong tab "Portfolio"
2. Kiểm tra alerts để biết khi nào chốt lời
3. Xem dashboard để nắm tổng quan

### Bước 3: Thực Hiện Take Profit
1. Khi alerts báo đạt TP level
2. Vào tab "Take Profit Plan"
3. Checkbox "Đã chốt" và thêm giao dịch SELL vào Trade Log

### Bước 4: DCA Khi Giá Giảm
1. Khi alerts báo vào vùng DCA
2. Thêm giao dịch DCA vào Trade Log
3. Hệ thống tự động cập nhật giá mua trung bình

## Công Thức Tính Toán

### Giá Mua Trung Bình (DCA):
```
New Avg Price = (Current Holdings * Current Avg + New Purchase) / (Current Quantity + New Quantity)
```

### P&L Tính Toán:
```
Unrealized P&L = Current Value - Total Invested
P&L % = (Unrealized P&L / Total Invested) * 100
```

### Portfolio Weight:
```
Weight % = (Asset Value / Total Portfolio Value) * 100
```

## Lưu Ý Quan Trọng

### ✅ Nên Làm:
- Cập nhật giá thường xuyên để có thông tin chính xác
- Tuân thủ kế hoạch Take Profit để lock profit
- Ghi chú rõ ràng lý do mua/bán
- Rebalance khi cần thiết
- Backup dữ liệu bằng Export CSV

### ❌ Không Nên:
- Thay đổi kế hoạch Take Profit quá thường xuyên
- Bỏ qua cảnh báo rebalance
- FOMO mua thêm khi không có kế hoạch
- Panic sell khi giá giảm ngắn hạn

## Chiến Lược Đầu Tư

### Position Trading Rules:
1. **Phân bổ vốn**: Không đầu tư >40% vào 1 tài sản
2. **Take Profit**: Luôn chốt lời theo kế hoạch
3. **DCA**: Chỉ DCA khi có vốn dự phòng
4. **Hold**: Luôn giữ 20% cho long term
5. **Risk Management**: Stop loss nếu lỗ >50%

### Lời Khuyên:
- 📊 **Đầu tư có kế hoạch**: Xác định mục tiêu trước khi mua
- 💰 **Quản lý rủi ro**: Không đầu tư quá khả năng
- 🎯 **Kiên nhẫn**: Position trading là chiến lược dài hạn
- 📈 **Kỷ luật**: Tuân thủ kế hoạch Take Profit
- 🔄 **Linh hoạt**: Điều chỉnh khi thị trường thay đổi

## Tính Năng Nâng Cao

### Export/Import:
- **Export CSV**: Tất cả giao dịch có thể export
- **Backup**: Dữ liệu lưu trong localStorage
- **Mobile-friendly**: Responsive trên mọi thiết bị

### Tùy Chỉnh:
- **TP Levels**: Có thể chỉnh sửa target price
- **Sell %**: Tùy chỉnh % chốt ở mỗi level
- **Notes**: Ghi chú chi tiết cho mọi giao dịch

## Troubleshooting

### Vấn Đề Thường Gặp:
1. **Không thấy TP levels**: Đảm bảo đã thêm giao dịch BUY
2. **Giá không cập nhật**: Nhập lại giá thủ công
3. **Alert không hiện**: Kiểm tra điều kiện trigger
4. **Dữ liệu mất**: Kiểm tra localStorage browser

### Liên Hệ Hỗ Trợ:
- GitHub Issues: Report bugs và feature requests
- Documentation: Đọc guide này thường xuyên
- Community: Chia sẻ kinh nghiệm với community

---

**Phiên bản**: 1.0.0  
**Cập nhật**: 2025-01-01  
**Tác giả**: Claude Code System