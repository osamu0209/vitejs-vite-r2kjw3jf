import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import "./App.css";

type FoodId = "meat" | "fish" | "vegetable" | "rice" | "curry" | "sweets" | "tofu" | "natto";
type Food = { id: FoodId; name: string; emoji: string; points: number; weight: number };

const FOODS: Food[] = [
  { id: "meat", name: "お肉", emoji: "🍖", points: -100, weight: 0 },
  { id: "fish", name: "お魚", emoji: "🐟", points: 10, weight: 25 },
  { id: "vegetable", name: "野菜", emoji: "🥦", points: 5, weight: 24 },
  { id: "rice", name: "ご飯", emoji: "🍚", points: 20, weight: 18 },
  { id: "curry", name: "カレー", emoji: "🍛", points: 50, weight: 12 },
  { id: "sweets", name: "スイーツ", emoji: "🍰", points: 100, weight: 7 },
  { id: "tofu", name: "豆腐", emoji: "🧊", points: -2, weight: 9 },
  { id: "natto", name: "納豆", emoji: "🫘", points: -5, weight: 5 },
];

type Pig = { x: number; y: number; direction: 1 | -1; speed: number; bob: number };
type Projectile = { id: number; x: number; y: number; vx: number; vy: number; food: Food; rotation: number };
type FloatText = { id: number; x: number; y: number; text: string; good: boolean };

const pickFood = (meatLeft: number): Food => {
  if (meatLeft > 0 && Math.random() < 0.065) return FOODS[0];
  const pool = FOODS.slice(1);
  const total = pool.reduce((sum, food) => sum + food.weight, 0);
  let roll = Math.random() * total;
  for (const food of pool) {
    roll -= food.weight;
    if (roll <= 0) return food;
  }
  return pool[0];
};

export default function App() {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [selected, setSelected] = useState<Food | null>(null);
  const [throws, setThrows] = useState(0);
  const [hits, setHits] = useState(0);
  const [meatLeft, setMeatLeft] = useState(5);
  const [floatTexts, setFloatTexts] = useState<FloatText[]>([]);
  const [pigView, setPigView] = useState({ x: 50, y: 34 });
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const pigRef = useRef<Pig>({ x: 50, y: 34, direction: 1, speed: 0.23, bob: 0 });
  const projectilesRef = useRef<Projectile[]>([]);
  const nextId = useRef(0);
  const meatRef = useRef(5);

  const startGame = () => {
    setScore(0); setTimeLeft(60); setThrows(0); setHits(0); setMeatLeft(5);
    meatRef.current = 5;
    setSelected(pickFood(5)); setFloatTexts([]); setProjectiles([]);
    projectilesRef.current = [];
    pigRef.current = { x: 50, y: 34, direction: 1, speed: 0.23, bob: 0 };
    setPigView({ x: 50, y: 34 });
    setFinished(false); setPlaying(true);
  };

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { setPlaying(false); setFinished(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let raf = 0;
    const animate = () => {
      const pig = pigRef.current;
      pig.x += pig.speed * pig.direction;
      if (pig.x > 86) { pig.x = 86; pig.direction = -1; }
      if (pig.x < 14) { pig.x = 14; pig.direction = 1; }
      pig.bob += 0.055;
      pig.y = 32 + Math.sin(pig.bob) * 5;
      const updated = projectilesRef.current.map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.16, rotation: p.rotation + 7 }))
        .filter((p) => p.y < 110 && p.x > -5 && p.x < 105);
      const remaining: Projectile[] = [];
      updated.forEach((p) => {
        const dx = p.x - pig.x;
        const dy = p.y - pig.y;
        if (Math.hypot(dx, dy) < 8.5) {
          setScore((s) => s + p.food.points);
          setHits((h) => h + 1);
          setFloatTexts((items) => [...items, { id: p.id, x: pig.x, y: pig.y - 8, text: `${p.food.points > 0 ? "+" : ""}${p.food.points}`, good: p.food.points > 0 }]);
        } else remaining.push(p);
      });
      projectilesRef.current = remaining;
      if (frame % 2 === 0) {
        setPigView({ x: pig.x, y: pig.y });
        setProjectiles(remaining);
      }
      frame++;
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    if (!floatTexts.length) return;
    const timer = window.setTimeout(() => setFloatTexts((items) => items.slice(1)), 850);
    return () => window.clearTimeout(timer);
  }, [floatTexts]);

  const throwFood = useCallback((clientX?: number, clientY?: number) => {
    if (!playing || !selected || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const startX = clientX == null ? rect.width / 2 : Math.max(20, Math.min(rect.width - 20, clientX - rect.left));
    const startY = clientY == null ? rect.height - 45 : Math.max(rect.height * 0.58, Math.min(rect.height - 20, clientY - rect.top));
    const targetX = (pigRef.current.x / 100) * rect.width;
    const targetY = (pigRef.current.y / 100) * rect.height;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const speed = 10;
    const length = Math.max(1, Math.hypot(dx, dy));
    const food = selected;
    const id = ++nextId.current;
    projectilesRef.current = [...projectilesRef.current, { id, x: startX / rect.width * 100, y: startY / rect.height * 100, vx: dx / length * speed / rect.width * 100, vy: dy / length * speed / rect.height * 100, food, rotation: 0 }];
    setThrows((n) => n + 1);
    if (food.id === "meat") {
      const next = Math.max(0, meatRef.current - 1);
      meatRef.current = next; setMeatLeft(next);
    }
    setSelected(pickFood(meatRef.current));
  }, [playing, selected]);

  const onFieldPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!playing || !selected) return;
    throwFood(event.clientX, event.clientY);
  };

  return (
    <main className="app-shell">
      <div className="game-card">
        <header className="topbar">
          <div className="brand"><span className="brand-icon">🐷</span><span>ぶたさんフリック！</span></div>
          <div className="timer"><span>TIME</span><strong>{String(timeLeft).padStart(2, "0")}</strong></div>
        </header>
        <section className="score-row" aria-label="ゲーム情報">
          <div className="score-box"><span>スコア</span><strong>{score}</strong><small>点</small></div>
          <div className="mini-stat"><span>命中</span><b>{hits}</b></div>
          <div className="mini-stat"><span>投げた数</span><b>{throws}</b></div>
        </section>
        <section className="playfield" ref={fieldRef} onPointerUp={onFieldPointerUp} aria-label="ゲーム画面">
          <div className="cloud cloud-one">☁️</div><div className="cloud cloud-two">☁️</div>
          <div className="sun">☀️</div>
          <div className="field-hint">{playing ? "ぶたさんをねらってタップ！" : "スタートして食材を投げよう！"}</div>
          <div className="pig" style={{ left: `${pigView.x}%`, top: `${pigView.y}%`, transform: `translate(-50%, -50%) scaleX(${pigRef.current.direction})` }}>
            <span className="pig-tail">〰</span><span className="pig-body">🐷</span><span className="pig-wing">✦</span>
          </div>
          {projectiles.map((p) => <div className="projectile" key={p.id} style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%, -50%) rotate(${p.rotation}deg)` }}>{p.food.emoji}</div>)}
          {floatTexts.map((item) => <div className={`float-text ${item.good ? "positive" : "negative"}`} key={item.id} style={{ left: `${item.x}%`, top: `${item.y}%` }}>{item.text}</div>)}
          {!playing && !finished && <div className="overlay"><div className="overlay-panel"><div className="big-pig">🐷</div><h1>空飛ぶぶたさんを<br/>ねらってフリック！</h1><p>食材を投げて、ぶたさんに当てよう！</p><button className="primary-button" onPointerUp={(e) => e.stopPropagation()} onClick={startGame}>ゲームスタート</button></div></div>}
          {finished && <div className="overlay"><div className="overlay-panel result-panel"><div className="big-pig">🏆</div><h2>ゲーム終了！</h2><div className="final-score">{score}<small>点</small></div><p>命中 {hits} 回 ／ 投げた数 {throws} 回</p><button className="primary-button" onPointerUp={(e) => e.stopPropagation()} onClick={startGame}>もう一度あそぶ</button></div></div>}
        </section>
        <section className="bottom-panel">
          <div className="food-heading"><div><b>投げる食材</b><span>タップして選択</span></div><span className="meat-count">🍖 お肉 残り {meatLeft}/5</span></div>
          <div className="food-tray">
            {FOODS.map((food) => <button key={food.id} className={`food-button ${selected?.id === food.id ? "selected" : ""} ${food.id === "meat" && meatLeft === 0 ? "disabled-food" : ""}`} disabled={!playing || (food.id === "meat" && meatLeft === 0)} onClick={() => setSelected(food)}>
              <span className="food-emoji">{food.emoji}</span><span className="food-name">{food.name}</span><span className={`food-points ${food.points < 0 ? "minus" : ""}`}>{food.points > 0 ? "+" : ""}{food.points}</span>
            </button>)}
          </div>
          <div className="bottom-note">{playing ? <><span className="live-dot"/>プレイ中：画面をタップして投げることもできます</> : "制限時間は60秒。高得点の食材ほど出現率が低くなります。"}</div>
        </section>
      </div>
      <footer>© ぶたさんフリック！ <span>スマホ・タブレット・PC対応</span></footer>
    </main>
  );
}
