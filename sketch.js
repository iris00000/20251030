let csvData; // 用於儲存從 CSV 載入的原始資料
let questions = []; // 儲存格式化後的問題物件
let currentQuestionIndex = 0;
let score = 0;
let gameState = 'start'; // 狀態機: 'start', 'quiz', 'results'
let selectedOption = -1; // -1 表示尚未選擇

// --- 特效相關變數 ---
// 游標點擊特效
let clickEffects = []; // 儲存所有點擊漣漪
// 選項選取特效
let lastSelectedTime = 0; // 上次選擇選項的時間
let selectionEffectRadius = 0; // 選項特效的半徑

// 1. 預先載入
function preload() {
    // 不在 preload 載入外部 CSV，避免 preload 阻塞瀏覽器或被本機檔案存取限制卡住
}

// 2. 初始化
function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont('Helvetica');
    textAlign(CENTER, CENTER);
    noCursor();

    // 先用備用題庫，保證畫面可立即顯示
    parseCSVData();
    questions = shuffle(questions);

    // 非同步嘗試載入 question.csv（檔名與你提供的 CSV 一致）
    try {
        loadTable('question.csv', 'csv', 'header',
            (tbl) => {
                console.log('question.csv 載入成功');
                csvData = tbl;
                parseCSVData();
                questions = shuffle(questions);
            },
            (err) => {
                console.warn('載入 question.csv 失敗:', err);
                csvData = null;
            }
        );
    } catch (e) {
        console.warn('loadTable 發生例外', e);
        csvData = null;
    }
}

// 3. 主繪製迴圈 (p5.js 的核心)
function draw() {
    background(245); // 淺灰色背景

    // 根據不同的遊戲狀態，呼叫不同的繪製函數
    switch (gameState) {
        case 'start':
            drawStartScreen();
            break;
        case 'quiz':
            drawQuizScreen();
            break;
        case 'results':
            drawResultsScreen();
            break;
    }

    // 繪製自訂游標和點擊特效
    drawCursorEffects();
}

// ----------------------------------------
// CSV 資料處理
// ----------------------------------------
function parseCSVData() {
    questions = []; // 清空，確保重複呼叫不會累加

    // 若 csvData 不可用或沒有列，使用備用題目，並在 console 記錄
    if (!csvData || typeof csvData.getRowCount !== 'function' || csvData.getRowCount() === 0) {
        console.warn('CSV 未正確載入或沒有資料，改用備用題目。請確認 questions.csv 與欄位名稱（question, optionA, optionB, optionC, optionD, answer）是否正確。');
        questions = createFallbackQuestions();
        return;
    }

    // 嘗試解析每一列，並且容錯（normalize answer）
    for (let i = 0; i < csvData.getRowCount(); i++) {
        try {
            let row = csvData.getRow(i);

            let qText = row.getString('question') || row.getString(0) || '';
            let opts = [
                row.getString('optionA') || row.getString(1) || '',
                row.getString('optionB') || row.getString(2) || '',
                row.getString('optionC') || row.getString(3) || '',
                row.getString('optionD') || row.getString(4) || ''
            ];

            let rawAns = (row.getString('answer') || '').toString().trim().toUpperCase();
            // 若 answer 是數字 1-4，轉成 A-D
            if (rawAns.length === 1 && '1234'.includes(rawAns)) {
                rawAns = ['A', 'B', 'C', 'D'][parseInt(rawAns) - 1];
            }
            // 若 answer 是空的或非 A-D，預設為 A（但仍保留題目）
            if (!['A', 'B', 'C', 'D'].includes(rawAns)) {
                console.warn(`第 ${i + 1} 列的 answer 欄位無效：${rawAns}，已設為 A 作為預設。`);
                rawAns = 'A';
            }

            questions.push({
                question: qText,
                options: opts,
                answer: rawAns
            });
        } catch (e) {
            console.warn('解析 CSV 第 ' + (i + 1) + ' 列發生錯誤，已跳過。', e);
        }
    }

    // 若解析後仍無題目，改用備用題目
    if (questions.length === 0) {
        console.warn('解析後無有效題目，改用備用題目。');
        questions = createFallbackQuestions();
    }
}

// 新增：簡單的備用題庫，確保 UI 可正常顯示
function createFallbackQuestions() {
    return [
        {
            question: '範例題：下列哪一個是 JavaScript 的檔案副檔名？',
            options: ['.js', '.py', '.java', '.rb'],
            answer: 'A'
        },
        {
            question: '範例題：HTML 用於什麼？',
            options: ['結構 (structure)', '資料庫', '伺服器程式', '繪圖層'],
            answer: 'A'
        }
    ];
}

// ----------------------------------------
// 狀態繪製函數 (Start, Quiz, Results)
// ----------------------------------------

// 繪製開始畫面
function drawStartScreen() {
    // 標題
    fill(50);
    textSize(48);
    text('p5.js 互動測驗系統', width / 2, height / 2 - 100);

    // 開始按鈕
    drawButton('開始測驗', width / 2, height / 2 + 50, 300, 70);
}

// 繪製測驗畫面
function drawQuizScreen() {
    if (questions.length === 0) {
        fill(200, 0, 0);
        textSize(24);
        text('錯誤：找不到題目。請確認 questions.csv 檔案是否存在。', width/2, height/2);
        return;
    }

    let q = questions[currentQuestionIndex];

    // 確保題目置中：水平與垂直都置中，並設定行距與限制寬高
    push();
    // 明確設定文字相關屬性，避免被其他程式碼覆寫導致不可見
    textAlign(CENTER, CENTER); // 水平與垂直置中
    fill(40); // 深色文字，避免與背景相同造成看不見
    textWrap(WORD); // 逐字換行
    // 文字大小跟畫面大小相關，避免在大或小螢幕消失
    let baseSize = constrain(min(width, height) / 30, 18, 40);
    textSize(baseSize);
    textLeading(baseSize * 1.2); // 行距，避免換行擠在一起

    let boxW = width * 0.8;
    let boxH = max(height * 0.18, baseSize * 4); // 題目區塊高度（確保至少可容納幾行）
    // 在以 (width/2, height/4) 為中點的方框內置中繪製題目
    let questionText = q.question && q.question.trim() !== '' ? q.question : '（題目內容為空）';
    text(questionText, width / 2, height / 4, boxW, boxH);
    pop();

    // 繪製選項按鈕
    let optionsYStart = height / 2;
    let optionHeight = max(50, baseSize * 1.6);
    for (let i = 0; i < q.options.length; i++) {
        let y = optionsYStart + i * (optionHeight + 15);
        // 檢查此選項是否被選取
        let isSelected = (i === selectedOption);
        drawButton(q.options[i], width / 2, y, width * 0.6, optionHeight, isSelected);
    }

    // 繪製進度
    textSize(18);
    fill(100);
    text(`第 ${currentQuestionIndex + 1} / ${questions.length} 題`, width / 2, height - 50);

    // 如果已選擇答案，顯示 "下一題" 按鈕
    if (selectedOption !== -1) {
        drawButton('下一題', width / 2, height - 100, 200, 50);
    }
}

// 繪製結果畫面
function drawResultsScreen() {
    let percentage = (score / questions.length) * 100;

    // 顯示分數
    fill(50);
    textSize(32);
    text(`測驗結束！`, width / 2, height / 3);
    textSize(48);
    text(`你的得分: ${percentage.toFixed(1)}%`, width / 2, height / 3 + 60);
    text(`(${score} / ${questions.length})`, width / 2, height / 3 + 120);

    // 根據分數顯示不同的動畫
    if (percentage >= 80) {
        drawPraiseAnimation(); // 稱讚的動畫
    } else {
        drawEncouragementAnimation(); // 鼓勵的動畫
    }

    // 重新開始按鈕
    drawButton('重新開始', width / 2, height - 100, 250, 60);
}

// ----------------------------------------
// 動畫函數 (Praise / Encouragement)
// ----------------------------------------

// 稱讚的動畫 (五彩紙屑)
function drawPraiseAnimation() {
    push();
    textSize(40);
    fill(255, 180, 0); // 金色
    text('太棒了！你真是個天才！', width / 2, height / 2 + 50);

    // 隨機產生掉落的五彩紙屑
    for (let i = 0; i < 3; i++) {
        let x = random(width);
        let y = (frameCount * 5 + random(height)) % height; // 隨機Y軸啟動
        let col = color(random(150, 255), random(100, 255), random(100, 255));
        fill(col);
        noStroke();
        rect(x, y, 10, 20, 5);
    }
    pop();
}

// 鼓勵的動畫 (溫和的呼吸光暈)
function drawEncouragementAnimation() {
    push();
    textSize(40);
    fill(0, 150, 255); // 溫和的藍色
    text('別灰心，再接再厲！', width / 2, height / 2 + 50);

    // 繪製一個 "呼吸" 的圓形光暈
    // 使用 sin() 函數創造 0 到 1 之間的平滑擺動
    let breath = (sin(frameCount * 0.03) + 1) / 2; // 值在 0 到 1 之間
    let radius = 50 + breath * 30;
    let alpha = 50 + breath * 100; // 50 到 150 的透明度

    fill(0, 150, 255, alpha);
    noStroke();
    ellipse(width / 2, height / 2 + 130, radius * 2);
    pop();
}

// ----------------------------------------
// 互動與特效 (Mouse, Cursor, Button)
// ----------------------------------------

// 滑鼠點擊事件
function mousePressed() {
    // 觸發點擊漣漪特效
    clickEffects.push({ x: mouseX, y: mouseY, radius: 0, alpha: 255 });

    // 根據遊戲狀態處理點擊
    if (gameState === 'start') {
        // 檢查是否點擊 "開始測驗"
        if (isMouseOver(width / 2, height / 2 + 50, 300, 70)) {
            gameState = 'quiz';
        }
    } else if (gameState === 'quiz') {
        let optionsYStart = height / 2;
        let optionHeight = 60;
        let optionClicked = false;

        // 檢查是否點擊了某個選項
        for (let i = 0; i < 4; i++) {
            let y = optionsYStart + i * (optionHeight + 15);
            if (isMouseOver(width / 2, y, width * 0.6, optionHeight)) {
                selectedOption = i;
                // 觸發選項特效
                lastSelectedTime = millis();
                selectionEffectRadius = 0;
                optionClicked = true;
                break;
            }
        }

        // 如果沒有點擊選項，檢查是否點擊 "下一題"
        if (!optionClicked && selectedOption !== -1) {
            if (isMouseOver(width / 2, height - 100, 200, 50)) {
                checkAnswer();
                nextQuestion();
            }
        }
    } else if (gameState === 'results') {
        // 檢查是否點擊 "重新開始"
        if (isMouseOver(width / 2, height - 100, 250, 60)) {
            resetQuiz();
        }
    }
}

// 繪製按鈕 (包含懸停和選取特效)
function drawButton(label, x, y, w, h, isSelected = false) {
    let onHover = isMouseOver(x, y, w, h);
    
    push();
    translate(x, y);
    rectMode(CENTER);
    
    let currentW = onHover ? w * 1.02 : w; // 懸停時放大
    let currentH = onHover ? h * 1.02 : h;

    // 選項選取特效 (如果此按鈕是剛被選取的)
    if (isSelected) {
        let effectDuration = 500; // 0.5 秒
        let timePassed = millis() - lastSelectedTime;
        
        if (timePassed < effectDuration) {
            selectionEffectRadius = map(timePassed, 0, effectDuration, w/2, w);
            let effectAlpha = map(timePassed, 0, effectDuration, 150, 0);
            strokeWeight(4);
            stroke(0, 200, 100, effectAlpha);
            noFill();
            ellipse(0, 0, selectionEffectRadius);
        }
    }

    // 按鈕樣式
    strokeWeight(3);
    if (isSelected) {
        fill(200, 255, 200); // 選取時：亮綠色
        stroke(0, 150, 0);
    } else if (onHover) {
        fill(230); // 懸停時：淺灰
        stroke(100);
    } else {
        fill(255); // 預設：白色
        stroke(150);
    }
    
    rect(0, 0, currentW, currentH, 10); // 圓角矩形

    // 按鈕文字
    noStroke();
    fill(isSelected ? 0 : 50); // 選取時文字變黑
    textSize(h * 0.4); // 文字大小與按鈕高度相關
    text(label, 0, 0);
    
    pop();
}

// 繪製自訂游標和點擊特效
function drawCursorEffects() {
    // 繪製點擊漣漪
    for (let i = clickEffects.length - 1; i >= 0; i--) {
        let effect = clickEffects[i];
        push();
        noFill();
        strokeWeight(2);
        stroke(255, 0, 0, effect.alpha); // 紅色漣漪
        ellipse(effect.x, effect.y, effect.radius);
        pop();
        
        effect.radius += 5;
        effect.alpha -= 10;

        // 移除太舊的特效
        if (effect.alpha <= 0) {
            clickEffects.splice(i, 1);
        }
    }

    // 繪製自訂游標
    fill(255, 0, 0, 200); // 半透明紅色
    noStroke();
    ellipse(mouseX, mouseY, 15, 15);
    fill(255);
    ellipse(mouseX, mouseY, 5, 5);
}

// 輔助函數：檢查滑鼠是否在矩形區域內
// (使用 CENTER 模式)
function isMouseOver(x, y, w, h) {
    return (
        mouseX > x - w / 2 &&
        mouseX < x + w / 2 &&
        mouseY > y - h / 2 &&
        mouseY < y + h / 2
    );
}

// ----------------------------------------
// 測驗邏輯
// ----------------------------------------

// 檢查答案
function checkAnswer() {
    let q = questions[currentQuestionIndex];
    // 將答案 'A', 'B', 'C', 'D' 轉換為索引 0, 1, 2, 3
    let correctIndex = q.answer.charCodeAt(0) - 'A'.charCodeAt(0);

    if (selectedOption === correctIndex) {
        score++;
    }
}

// 進入下一題
function nextQuestion() {
    currentQuestionIndex++;
    selectedOption = -1; // 重置選項
    
    // 如果題目都答完了，進入結果畫面
    if (currentQuestionIndex >= questions.length) {
        gameState = 'results';
    }
}

// 重設測驗
function resetQuiz() {
    score = 0;
    currentQuestionIndex = 0;
    selectedOption = -1;
    questions = shuffle(questions); // 重新打亂題目
    gameState = 'start'; // 回到開始畫面
}

// 視窗大小改變時，重新設定畫布
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}