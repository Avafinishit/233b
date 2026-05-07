# 屏幕尺寸选择功能说明

## 功能概述
实现了一个完整的屏幕尺寸选择界面，用户可以从预设尺寸中选择或自定义屏幕尺寸。

## 使用方法
1. 打开应用，进入"设置"
2. 点击"外观"选项
3. 在外观设置中，会看到屏幕尺寸选择页面
4. 选择以下任一选项：
   - **适中尺寸**: 350×740 (推荐)
   - **iPhone 15**: 425×860 (适配手机)
   - **iPhone 15 Plus**: 450×950 (大屏)
   - **自定义尺寸**: 点击后可输入自定义宽高

## 预设尺寸详情
- **适中尺寸 (medium)**: 350×740px - 推荐日常使用
- **iPhone 15 (iphone15)**: 425×860px - 标准手机尺寸
- **iPhone 15 Plus (iphone15plus)**: 450×950px - 大屏手机尺寸
- **小屏 (small)**: 300×639px - 紧凑显示
- **大屏 (large)**: 425×860px - 宽松显示

## 自定义尺寸
- 宽度范围: 280-600px
- 高度范围: 500-1000px
- 输入验证: 超出范围会提示错误

## 技术实现

### 文件修改
1. **index.html**
   - 添加屏幕尺寸选择页面 (`app-screen-size`)
   - 添加自定义尺寸弹窗 (`customSizeModal`)
   - 修改外观设置入口，改为调用 `openScreenSizeSettings()`

2. **css/style.css**
   - 添加新的尺寸类: `phone-mode-iphone15`, `phone-mode-iphone15plus`, `phone-mode-custom`
   - 更新所有相关CSS选择器以支持新尺寸

3. **css/screen-size.css** (新建)
   - 屏幕尺寸选择页面的专用样式
   - 卡片式布局
   - 选中状态样式
   - 手机预览图标

4. **js/app.js**
   - `openScreenSizeSettings()`: 打开屏幕尺寸选择页面
   - `selectScreenSize(size)`: 选择预设尺寸
   - `showCustomSizeModal()`: 显示自定义尺寸弹窗
   - `applyCustomSize()`: 应用自定义尺寸
   - `updateScreenSizeSelection()`: 更新选中状态UI
   - `updateAppearanceSummary()`: 更新外观摘要显示
   - 修改 `applyAppearanceSettings()`: 支持自定义尺寸的动态设置

### 数据存储
```javascript
appearanceSettings = {
    displayMode: 'phone',  // 'fullscreen' 或 'phone'
    screenSize: 'medium',  // 'small', 'medium', 'large', 'iphone15', 'iphone15plus', 'custom'
    customWidth: 375,      // 自定义宽度
    customHeight: 812,     // 自定义高度
    showStatusBar: true
}
```

## 用户体验优化
1. **即时反馈**: 选择尺寸后自动返回主屏幕，立即看到效果
2. **视觉提示**: 选中的选项显示蓝色背景和勾选标记
3. **Toast提示**: 切换尺寸时显示提示信息（如果DataManager可用）
4. **平滑过渡**: 300-500ms延迟返回，让用户感知到变化

## 注意事项
1. 选择尺寸后会自动切换到手机模式（非全屏）
2. 自定义尺寸会通过JavaScript动态设置容器的width和height
3. 所有设置会保存到localStorage，刷新页面后保持
4. 在屏幕尺寸选择页面内看不到尺寸变化，需要返回主屏幕才能看到效果

## 测试步骤
1. 打开 index.html
2. 进入设置 → 外观
3. 尝试选择不同的预设尺寸，观察主屏幕容器大小变化
4. 点击"自定义尺寸"，输入自定义值（如 400×800）
5. 验证尺寸是否正确应用
6. 刷新页面，验证设置是否保持

## 已知问题
- 在设置应用内部时看不到外层容器的尺寸变化（这是正常的，因为你在应用视图内部）
- 需要返回主屏幕才能看到完整的尺寸变化效果
