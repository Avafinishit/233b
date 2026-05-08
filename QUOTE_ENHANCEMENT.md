# 引用功能完善说明

## 已解决的三个问题

### ✅ 问题1：发送后的消息显示引用

**实现效果**：
- 带引用的消息上方显示引用条
- 引用条样式：浅灰背景 `rgba(0, 0, 0, 0.03)` + 左侧细竖线
- 显示被引用消息的作者名和内容（最多2行）
- 点击引用条可滚动到原消息并高亮

**技术实现**：
- 修改了 `createMessageContentElement()` 函数
- 如果消息包含 `quotedMessage` 字段，先渲染引用块
- 引用块可点击，调用 `scrollToMessage()` 跳转

### ✅ 问题2：发送给AI时包含引用上下文

**实现效果**：
- 用户引用消息后，AI能看到引用关系
- 引用信息格式：`[用户引用了角色名之前说的："消息内容"，并回复：]\n用户回复`
- AI可以理解用户在回复哪条消息

**技术实现**：
- 修改了 `buildChatHistoryForAPI()` 函数
- 检查消息是否包含 `quotedMessage` 字段
- 如果有，在消息内容前添加引用上下文
- 支持文本和vision模式

**代码示例**：
```javascript
if (msg.quotedMessage) {
    const quotedContent = typeof msg.quotedMessage.content === 'string'
        ? msg.quotedMessage.content
        : normalizeChatContentForAPI(msg.quotedMessage.content, 'assistant');
    
    const quotedAuthor = msg.quotedMessage.authorName || '对方';
    const quotePrefix = `[用户引用了${quotedAuthor}之前说的："${quotedContent}"，并回复：]\n`;
    
    normalizedContent = quotePrefix + normalizedContent;
}
```

### ✅ 问题3：角色也能主动引用消息

**实现效果**：
- AI可以在回复中使用引用语法：`[quote:msg_xxx]回复内容`
- 系统自动解析引用标记并渲染引用条
- AI的引用消息也会显示引用关系

**技术实现**：

1. **系统提示词增强**：
```
引用功能说明：
- 当你想引用之前的某条消息时（例如追问、回应很久之前的话题、强调某句话），可以使用引用语法
- 引用格式：在回复开头使用 [quote:消息ID]，系统会自动显示引用关系
- 消息ID可以从对话历史中获取（格式如 msg_1234567890_abc123）
- 引用后直接写你的回复内容，不需要重复被引用的内容
- 示例：[quote:msg_1234567890_abc123]你刚才说的那个是什么意思？
- 只在确实需要引用时使用，不要滥用
```

2. **解析AI引用**：
```javascript
function parseAIQuote(reply) {
    const quoteMatch = reply.match(/^\[quote:(msg_[^\]]+)\]\s*/);
    
    if (!quoteMatch) {
        return { hasQuote: false, quotedMessageId: null, content: reply };
    }
    
    const quotedMessageId = quoteMatch[1];
    const content = reply.replace(quoteMatch[0], '').trim();
    
    return { hasQuote: true, quotedMessageId, content };
}
```

3. **构建引用数据**：
```javascript
function buildQuotedMessageData(messageId) {
    const message = chatHistory.find(m => String(m.id) === String(messageId));
    if (!message) return null;
    
    const role = wechatRoles.find(r => r.id === currentRoleId);
    const authorName = message.role === 'user' ? '你' : (role?.nickname || '对方');
    
    return {
        id: message.id,
        content: message.content,
        authorName
    };
}
```

4. **AI回复处理**：
```javascript
// 解析AI回复中的引用标记
const { hasQuote, quotedMessageId, content: replyContent } = parseAIQuote(reply);
let aiQuotedMessage = null;

if (hasQuote && quotedMessageId) {
    aiQuotedMessage = buildQuotedMessageData(quotedMessageId);
    reply = replyContent; // 使用去除引用标记后的内容
}

// 创建消息时包含引用信息
const messageData = {
    id: messageId,
    content: msg,
    timestamp: timestamp
};

if (idx === 0 && aiQuotedMessage) {
    messageData.quotedMessage = aiQuotedMessage;
}
```

## 数据结构

### 消息对象（chatHistory）
```javascript
{
    id: 'msg_1234567890_abc123',
    role: 'user' | 'assistant',
    content: '消息内容',
    timestamp: 1234567890,
    quotedMessage: {              // 可选，引用信息
        id: 'msg_xxx',
        content: '被引用的内容',
        authorName: '你' | '角色名'
    }
}
```

### 引用状态（currentQuotedMessage）
```javascript
{
    id: 'msg_xxx',
    content: '消息内容',
    role: 'user' | 'assistant',
    authorName: '你' | '角色名'
}
```

## 视觉效果

### 引用预览区（输入框上方）
- 背景：`rgba(0, 0, 0, 0.04)` + 毛玻璃
- 左侧竖线：3px 渐变色
- 作者名：12px 紫色
- 内容：13px 深灰，单行省略
- 关闭按钮：28px 圆形

### 引用条（消息中）
- 背景：`rgba(0, 0, 0, 0.03)`
- 左侧竖线：3px 半透明紫色
- 圆角：4px
- 作者名：11px 紫色
- 内容：13px 深灰，最多2行
- hover：背景变深

### 滚动跳转效果
- 平滑滚动到目标消息
- 紫色背景高亮 800ms
- 如果消息不存在，显示提示

## 使用场景

### 用户引用AI消息
1. 长按AI消息 → 点击"引用"
2. 输入框上方显示引用预览
3. 输入回复内容
4. 发送后消息上方显示引用条
5. AI能看到引用上下文

### AI主动引用消息
1. AI在合适时机使用引用语法
2. 例如：`[quote:msg_123]你刚才说的那个是什么意思？`
3. 系统自动解析并显示引用条
4. 用户可以点击引用条跳转到原消息

### 典型对话示例

**场景1：追问之前的话题**
```
用户：今天天气不错
AI：是啊，挺舒服的
用户：我们去公园吧
AI：好啊
[过了一会儿]
AI：[quote:msg_xxx]你刚才说去公园，几点出发？
```

**场景2：回应很久之前的话**
```
用户：我最近在学吉他
AI：哦，挺好的
[聊了其他话题]
用户：[引用"我最近在学吉他"]学了一周了，手指好疼
AI：正常的，多练就好了
```

**场景3：强调某句话**
```
用户：我觉得这个方案不太行
AI：为什么？
用户：[引用"我觉得这个方案不太行"]成本太高了
AI：[quote:msg_xxx]你说的成本问题确实要考虑
```

## 技术细节

### 引用信息传递流程

1. **用户引用**：
   - 点击"引用" → 保存到 `currentQuotedMessage`
   - 发送消息 → 包含 `quotedMessage` 字段
   - 构建API请求 → 添加引用上下文前缀

2. **AI引用**：
   - AI回复包含 `[quote:msg_xxx]`
   - 解析引用标记 → 提取消息ID
   - 查找原消息 → 构建引用数据
   - 渲染消息 → 显示引用条

### 引用上下文格式

**用户引用**：
```
[用户引用了小白之前说的："你也没睡"，并回复：]
哈哈
```

**AI引用**：
```
[小白引用了之前的消息："今天天气不错"，并回复：]
你刚才说的天气，现在好像要下雨了
```

### 兼容性处理

- 支持文本消息、图片、语音、表情包的引用
- 图片显示为 `[图片]`
- 语音显示转文字或 `[语音]`
- 表情包显示 `[表情包] 名称`

## 测试要点

### 基础功能
- [ ] 用户引用AI消息后发送，消息上方显示引用条
- [ ] 引用条显示正确的作者名和内容
- [ ] 点击引用条可以跳转到原消息
- [ ] AI能看到用户的引用上下文

### AI引用功能
- [ ] AI使用 `[quote:msg_xxx]` 语法
- [ ] 系统正确解析引用标记
- [ ] AI消息上方显示引用条
- [ ] 引用条可以点击跳转

### 边界情况
- [ ] 引用不存在的消息ID，显示"原消息未找到"
- [ ] 引用超长消息，正确截断显示
- [ ] 引用图片/语音消息，显示正确的占位符
- [ ] 刷新页面后引用关系保持

### 视觉效果
- [ ] 引用条样式轻量、原生
- [ ] 滚动跳转流畅
- [ ] 高亮闪烁效果正常
- [ ] 引用预览和引用条风格一致

## 代码变更统计

- `js/app.js`: 约 +150 行
  - 修改 `buildChatHistoryForAPI()` - 添加引用上下文
  - 修改 `buildRoleplaySystemPrompt()` - 添加引用说明
  - 新增 `parseAIQuote()` - 解析AI引用
  - 新增 `buildQuotedMessageData()` - 构建引用数据
  - 修改 AI 回复处理逻辑 - 识别和保存引用
  - 修改消息显示逻辑 - 渲染引用条

- `css/style.css`: 已有引用样式（之前实现）

## 后续优化建议

1. **引用链显示**
   - 如果引用的消息本身也引用了其他消息
   - 可以显示引用链路径

2. **引用消息预览优化**
   - 图片消息显示缩略图
   - 语音消息显示波形图标
   - 更丰富的视觉呈现

3. **AI引用智能化**
   - AI自动判断何时需要引用
   - 不需要手动指定消息ID
   - 基于语义理解自动匹配

4. **引用统计**
   - 统计哪些消息被引用最多
   - 显示引用关系图谱

5. **引用搜索**
   - 搜索包含引用的消息
   - 按引用关系筛选消息

## 注意事项

1. **消息ID格式**：AI需要使用正确的消息ID格式 `msg_timestamp_random`
2. **引用语法位置**：引用标记必须在回复开头
3. **引用内容长度**：引用条最多显示2行，超长自动截断
4. **性能考虑**：大量引用消息时，跳转性能可能受影响
5. **数据持久化**：引用关系保存在 localStorage，注意存储空间

## 完成状态

✅ 问题1：发送后的消息显示引用 - 已完成
✅ 问题2：发送给AI时包含引用上下文 - 已完成  
✅ 问题3：角色也能主动引用消息 - 已完成

所有三个问题都已解决，引用功能现在支持双向引用（用户→AI，AI→用户）。
