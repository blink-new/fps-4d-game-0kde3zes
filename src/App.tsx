import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from './components/ui/card'
import { Button } from './components/ui/button'
import { Progress } from './components/ui/progress'

interface Enemy {
  id: string
  x: number
  y: number
  z: number
  w: number // 4th dimension coordinate
  health: number
  maxHealth: number
  type: 'normal' | 'dimensional' | 'boss'
  color: string
  size: number
  isActive: boolean
}

interface Player {
  x: number
  y: number
  z: number
  w: number
  health: number
  maxHealth: number
  ammo: number
  maxAmmo: number
  score: number
  level: number
}

interface Crosshair {
  x: number
  y: number
}

const FPSGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameOver'>('menu')
  const [player, setPlayer] = useState<Player>({
    x: 0,
    y: 0,
    z: 0,
    w: 0,
    health: 100,
    maxHealth: 100,
    ammo: 30,
    maxAmmo: 30,
    score: 0,
    level: 1
  })
  const [enemies, setEnemies] = useState<Enemy[]>([])
  const [crosshair, setCrosshair] = useState<Crosshair>({ x: 400, y: 300 })
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({})
  const [dimensionShift, setDimensionShift] = useState(0)
  const [timeWarp, setTimeWarp] = useState(1)
  const [reloading, setReloading] = useState(false)
  const [muzzleFlash, setMuzzleFlash] = useState(false)

  // Initialize game
  const initGame = useCallback(() => {
    setPlayer({
      x: 0,
      y: 0,
      z: 0,
      w: 0,
      health: 100,
      maxHealth: 100,
      ammo: 30,
      maxAmmo: 30,
      score: 0,
      level: 1
    })
    setEnemies(generateEnemies(5))
    setGameState('playing')
  }, [])

  // Generate enemies with 4D positioning
  const generateEnemies = (count: number): Enemy[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `enemy-${i}`,
      x: (Math.random() - 0.5) * 800,
      y: (Math.random() - 0.5) * 600,
      z: Math.random() * 200 - 100,
      w: Math.random() * 100 - 50,
      health: 50,
      maxHealth: 50,
      type: Math.random() > 0.8 ? 'dimensional' : 'normal',
      color: Math.random() > 0.8 ? '#ff0066' : '#ff3300',
      size: 20 + Math.random() * 10,
      isActive: true
    }))
  }

  // Handle shooting
  const shoot = useCallback(() => {
    if (player.ammo <= 0 || reloading) return

    setPlayer(prev => ({ ...prev, ammo: prev.ammo - 1 }))
    setMuzzleFlash(true)
    setTimeout(() => setMuzzleFlash(false), 100)

    // Check for hits
    setEnemies(prev => prev.map(enemy => {
      const distance = Math.sqrt(
        Math.pow(enemy.x - crosshair.x + 400, 2) +
        Math.pow(enemy.y - crosshair.y + 300, 2)
      )
      
      if (distance < enemy.size && enemy.isActive) {
        const newHealth = enemy.health - 25
        if (newHealth <= 0) {
          setPlayer(p => ({ ...p, score: p.score + 100 }))
          return { ...enemy, health: 0, isActive: false }
        }
        return { ...enemy, health: newHealth }
      }
      return enemy
    }))
  }, [player.ammo, reloading, crosshair])

  // Handle reloading
  const reload = useCallback(() => {
    if (reloading || player.ammo === player.maxAmmo) return
    setReloading(true)
    setTimeout(() => {
      setPlayer(prev => ({ ...prev, ammo: prev.maxAmmo }))
      setReloading(false)
    }, 2000)
  }, [reloading, player.ammo, player.maxAmmo])

  // 4D dimension shifting
  const shiftDimension = useCallback((direction: number) => {
    setDimensionShift(prev => Math.max(-100, Math.min(100, prev + direction * 10)))
    setPlayer(prev => ({ ...prev, w: prev.w + direction * 5 }))
  }, [])

  // Time warp mechanics
  const toggleTimeWarp = useCallback(() => {
    setTimeWarp(prev => prev === 1 ? 0.5 : 1)
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.code]: true }))
      
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          shoot()
          break
        case 'KeyR':
          reload()
          break
        case 'KeyQ':
          shiftDimension(-1)
          break
        case 'KeyE':
          shiftDimension(1)
          break
        case 'KeyT':
          toggleTimeWarp()
          break
        case 'Escape':
          setGameState(prev => prev === 'playing' ? 'paused' : 'playing')
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.code]: false }))
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [shoot, reload, shiftDimension, toggleTimeWarp])

  // Mouse controls
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (gameState !== 'playing') return
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        setCrosshair({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        })
      }
    }

    const handleClick = () => {
      if (gameState === 'playing') {
        shoot()
      }
    }

    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('mousemove', handleMouseMove)
      canvas.addEventListener('click', handleClick)
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove)
        canvas.removeEventListener('click', handleClick)
      }
    }
  }, [gameState, shoot])

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return

    const gameLoop = setInterval(() => {
      // Update enemy positions
      setEnemies(prev => prev.map(enemy => {
        if (!enemy.isActive) return enemy
        
        return {
          ...enemy,
          x: enemy.x + (Math.sin(Date.now() * 0.001 + enemy.id.length) * 2 * timeWarp),
          y: enemy.y + (Math.cos(Date.now() * 0.001 + enemy.id.length) * 2 * timeWarp),
          w: enemy.w + Math.sin(Date.now() * 0.002) * 0.5 * timeWarp
        }
      }))

      // Check if level complete
      if (enemies.every(enemy => !enemy.isActive)) {
        setPlayer(prev => ({ ...prev, level: prev.level + 1 }))
        setEnemies(generateEnemies(5 + player.level))
      }
    }, 16 / timeWarp)

    return () => clearInterval(gameLoop)
  }, [gameState, enemies, timeWarp, player.level])

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = `linear-gradient(45deg, #000033 ${dimensionShift + 50}%, #001166 ${100 - dimensionShift}%)`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw 4D grid effect
    ctx.strokeStyle = `rgba(0, 255, 255, ${0.2 + Math.abs(dimensionShift) * 0.01})`
    ctx.lineWidth = 1
    for (let i = 0; i < canvas.width; i += 50 + dimensionShift) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, canvas.height)
      ctx.stroke()
    }
    for (let i = 0; i < canvas.height; i += 50 + dimensionShift) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(canvas.width, i)
      ctx.stroke()
    }

    // Draw enemies with 4D effects
    enemies.forEach(enemy => {
      if (!enemy.isActive) return

      const wOffset = (enemy.w - player.w) * 2
      const size = enemy.size + wOffset
      const alpha = Math.max(0.1, 1 - Math.abs(wOffset) * 0.01)
      
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = enemy.color
      ctx.shadowColor = enemy.color
      ctx.shadowBlur = 20
      
      // Draw enemy
      ctx.beginPath()
      ctx.arc(
        enemy.x + 400 + wOffset,
        enemy.y + 300 + wOffset,
        Math.max(5, size),
        0,
        2 * Math.PI
      )
      ctx.fill()

      // Health bar
      if (enemy.health < enemy.maxHealth) {
        ctx.fillStyle = 'red'
        ctx.fillRect(enemy.x + 390, enemy.y + 280, 20, 3)
        ctx.fillStyle = 'green'
        ctx.fillRect(enemy.x + 390, enemy.y + 280, 20 * (enemy.health / enemy.maxHealth), 3)
      }
      
      ctx.restore()
    })

    // Draw crosshair
    ctx.strokeStyle = '#00ff00'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(crosshair.x - 10, crosshair.y)
    ctx.lineTo(crosshair.x + 10, crosshair.y)
    ctx.moveTo(crosshair.x, crosshair.y - 10)
    ctx.lineTo(crosshair.x, crosshair.y + 10)
    ctx.stroke()

    // Muzzle flash
    if (muzzleFlash) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.8)'
      ctx.beginPath()
      ctx.arc(crosshair.x, crosshair.y, 30, 0, 2 * Math.PI)
      ctx.fill()
    }

    // Time warp effect
    if (timeWarp !== 1) {
      ctx.fillStyle = 'rgba(0, 255, 255, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }, [enemies, crosshair, dimensionShift, player.w, muzzleFlash, timeWarp])

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="p-8 bg-black/50 backdrop-blur-lg border-purple-500">
          <div className="text-center space-y-6">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              FPS 4D
            </h1>
            <p className="text-xl text-gray-300">Experience combat in the fourth dimension</p>
            <div className="space-y-2 text-sm text-gray-400">
              <p>• WASD: Move</p>
              <p>• Mouse: Aim</p>
              <p>• Click/Space: Shoot</p>
              <p>• R: Reload</p>
              <p>• Q/E: Shift 4D dimension</p>
              <p>• T: Toggle time warp</p>
            </div>
            <Button onClick={initGame} className="px-8 py-4 text-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700">
              Start Game
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (gameState === 'paused') {
    return (
      <div className="min-h-screen bg-black/80 flex items-center justify-center">
        <Card className="p-6 bg-black/70 border-purple-500">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-white">Game Paused</h2>
            <Button onClick={() => setGameState('playing')} className="px-6 py-2">
              Resume
            </Button>
            <Button onClick={() => setGameState('menu')} variant="outline" className="ml-4 px-6 py-2">
              Main Menu
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border border-purple-500 cursor-none"
      />

      {/* HUD */}
      <div className="absolute top-4 left-4 space-y-2">
        <Card className="p-3 bg-black/70 border-purple-500">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-green-400 font-mono">HP:</span>
              <Progress value={player.health} className="w-32 h-2" />
              <span className="text-white text-sm">{player.health}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-400 font-mono">AMMO:</span>
              <span className="text-white font-mono">{player.ammo}/{player.maxAmmo}</span>
              {reloading && <span className="text-yellow-400 text-xs">RELOADING...</span>}
            </div>
          </div>
        </Card>
      </div>

      {/* Score and Level */}
      <div className="absolute top-4 right-4">
        <Card className="p-3 bg-black/70 border-purple-500">
          <div className="text-right space-y-1">
            <div className="text-yellow-400 font-mono">SCORE: {player.score}</div>
            <div className="text-cyan-400 font-mono">LEVEL: {player.level}</div>
          </div>
        </Card>
      </div>

      {/* 4D Controls */}
      <div className="absolute bottom-4 left-4">
        <Card className="p-3 bg-black/70 border-purple-500">
          <div className="space-y-2">
            <div className="text-purple-400 font-mono text-xs">4D DIMENSION</div>
            <Progress value={50 + dimensionShift / 2} className="w-32 h-2" />
            <div className="text-cyan-400 font-mono text-xs">
              TIME: {timeWarp === 1 ? 'NORMAL' : 'WARP'}
            </div>
          </div>
        </Card>
      </div>

      {/* Enemy Counter */}
      <div className="absolute bottom-4 right-4">
        <Card className="p-3 bg-black/70 border-purple-500">
          <div className="text-red-400 font-mono">
            ENEMIES: {enemies.filter(e => e.isActive).length}
          </div>
        </Card>
      </div>
    </div>
  )
}

function App() {
  return <FPSGame />
}

export default App