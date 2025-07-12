import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from './components/ui/card'
import { Button } from './components/ui/button'
import { Progress } from './components/ui/progress'

interface EnemyProjectile {
  id: string
  x: number
  y: number
  z: number
  w: number
  vx: number
  vy: number
  damage: number
  color: string
  size: number
  createdAt: number
}

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
  lastShot: number
  shootCooldown: number
  accuracy: number
  detectionRange: number
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
  lastDamaged: number
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
    level: 1,
    lastDamaged: 0
  })
  const [enemies, setEnemies] = useState<Enemy[]>([])
  const [enemyProjectiles, setEnemyProjectiles] = useState<EnemyProjectile[]>([])
  const [crosshair, setCrosshair] = useState<Crosshair>({ x: 400, y: 300 })
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({})
  const [dimensionShift, setDimensionShift] = useState(0)
  const [timeWarp, setTimeWarp] = useState(1)
  const [reloading, setReloading] = useState(false)
  const [muzzleFlash, setMuzzleFlash] = useState(false)
  const [damageFlash, setDamageFlash] = useState(false)

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
      level: 1,
      lastDamaged: 0
    })
    setEnemies(generateEnemies(5))
    setEnemyProjectiles([])
    setGameState('playing')
  }, [])

  // Generate enemies with 4D positioning and shooting capabilities
  const generateEnemies = (count: number): Enemy[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `enemy-${i}-${Date.now()}`,
      x: (Math.random() - 0.5) * 800,
      y: (Math.random() - 0.5) * 600,
      z: Math.random() * 200 - 100,
      w: Math.random() * 100 - 50,
      health: 50,
      maxHealth: 50,
      type: Math.random() > 0.8 ? 'dimensional' : 'normal',
      color: Math.random() > 0.8 ? '#ff0066' : '#ff3300',
      size: 20 + Math.random() * 10,
      isActive: true,
      lastShot: 0,
      shootCooldown: 1000 + Math.random() * 2000, // 1-3 seconds between shots
      accuracy: 0.3 + Math.random() * 0.4, // 30-70% accuracy
      detectionRange: 300 + Math.random() * 200 // 300-500 pixels detection range
    }))
  }

  // Enemy AI shooting logic
  const updateEnemyShooting = useCallback((currentTime: number) => {
    const newProjectiles: EnemyProjectile[] = []
    
    setEnemies(prev => prev.map(enemy => {
      if (!enemy.isActive) return enemy
      
      // Calculate distance to player (in screen coordinates)
      const dx = (crosshair.x - 400) - enemy.x
      const dy = (crosshair.y - 300) - enemy.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      // Check if enemy can shoot
      if (distance <= enemy.detectionRange && 
          currentTime - enemy.lastShot > enemy.shootCooldown) {
        
        // Calculate projectile trajectory with some inaccuracy
        const angle = Math.atan2(dy, dx)
        const inaccuracy = (Math.random() - 0.5) * (1 - enemy.accuracy) * Math.PI / 4
        const finalAngle = angle + inaccuracy
        
        const speed = 3 + Math.random() * 2 // 3-5 pixels per frame
        
        newProjectiles.push({
          id: `proj-${enemy.id}-${currentTime}`,
          x: enemy.x + 400,
          y: enemy.y + 300,
          z: enemy.z,
          w: enemy.w,
          vx: Math.cos(finalAngle) * speed,
          vy: Math.sin(finalAngle) * speed,
          damage: 15 + Math.random() * 10, // 15-25 damage
          color: enemy.type === 'dimensional' ? '#ff0066' : '#ff3300',
          size: 3 + Math.random() * 2,
          createdAt: currentTime
        })
        
        return { ...enemy, lastShot: currentTime }
      }
      
      return enemy
    }))
    
    // Add new projectiles
    if (newProjectiles.length > 0) {
      setEnemyProjectiles(prev => [...prev, ...newProjectiles])
    }
  }, [crosshair])

  // Update enemy projectiles and check for player hits
  const updateProjectiles = useCallback(() => {
    setEnemyProjectiles(prev => {
      const updated = prev.map(proj => ({
        ...proj,
        x: proj.x + proj.vx * timeWarp,
        y: proj.y + proj.vy * timeWarp
      })).filter(proj => {
        // Remove projectiles that are off-screen or too old
        const isOnScreen = proj.x > -50 && proj.x < 850 && proj.y > -50 && proj.y < 650
        const isNotTooOld = Date.now() - proj.createdAt < 5000 // 5 seconds max lifetime
        return isOnScreen && isNotTooOld
      })
      
      // Check for player hits
      updated.forEach(proj => {
        const playerScreenX = 400 + (player.x - proj.x + 400)
        const playerScreenY = 300 + (player.y - proj.y + 300)
        const distance = Math.sqrt(
          Math.pow(proj.x - 400, 2) + Math.pow(proj.y - 300, 2)
        )
        
        // Hit detection - if projectile is close to player center
        if (distance < 25) { // Player hit radius
          setPlayer(prevPlayer => {
            const newHealth = Math.max(0, prevPlayer.health - proj.damage)
            if (newHealth === 0) {
              setGameState('gameOver')
            }
            return {
              ...prevPlayer,
              health: newHealth,
              lastDamaged: Date.now()
            }
          })
          
          // Trigger damage flash
          setDamageFlash(true)
          setTimeout(() => setDamageFlash(false), 200)
          
          // Mark projectile for removal by setting x to invalid position
          proj.x = -1000
        }
      })
      
      // Remove projectiles that hit the player
      return updated.filter(proj => proj.x !== -1000)
    })
  }, [player.x, player.y, timeWarp])

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
      const currentTime = Date.now()
      
      // Update enemy positions
      setEnemies(prev => prev.map(enemy => {
        if (!enemy.isActive) return enemy
        
        return {
          ...enemy,
          x: enemy.x + (Math.sin(currentTime * 0.001 + enemy.id.length) * 2 * timeWarp),
          y: enemy.y + (Math.cos(currentTime * 0.001 + enemy.id.length) * 2 * timeWarp),
          w: enemy.w + Math.sin(currentTime * 0.002) * 0.5 * timeWarp
        }
      }))

      // Update enemy shooting
      updateEnemyShooting(currentTime)
      
      // Update projectiles
      updateProjectiles()

      // Check if level complete
      if (enemies.every(enemy => !enemy.isActive)) {
        setPlayer(prev => ({ ...prev, level: prev.level + 1 }))
        setEnemies(generateEnemies(5 + player.level))
        setEnemyProjectiles([]) // Clear projectiles on new level
      }
    }, 16 / timeWarp)

    return () => clearInterval(gameLoop)
  }, [gameState, enemies, timeWarp, player.level, updateEnemyShooting, updateProjectiles])

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = `linear-gradient(45deg, #000033 ${dimensionShift + 50}%, #001166 ${100 - dimensionShift}%)`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Damage flash effect
    if (damageFlash) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

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

    // Draw enemy projectiles
    enemyProjectiles.forEach(proj => {
      const wOffset = (proj.w - player.w) * 2
      const alpha = Math.max(0.1, 1 - Math.abs(wOffset) * 0.01)
      
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = proj.color
      ctx.shadowColor = proj.color
      ctx.shadowBlur = 10
      
      // Draw projectile with trail effect
      ctx.beginPath()
      ctx.arc(proj.x, proj.y, proj.size, 0, 2 * Math.PI)
      ctx.fill()
      
      // Trail effect
      ctx.globalAlpha = alpha * 0.5
      ctx.beginPath()
      ctx.arc(proj.x - proj.vx * 2, proj.y - proj.vy * 2, proj.size * 0.7, 0, 2 * Math.PI)
      ctx.fill()
      
      ctx.restore()
    })

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

      // Shooting indicator (glowing effect when about to shoot)
      const timeSinceLastShot = Date.now() - enemy.lastShot
      const timeUntilNextShot = enemy.shootCooldown - timeSinceLastShot
      if (timeUntilNextShot < 500 && timeUntilNextShot > 0) {
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(
          enemy.x + 400 + wOffset,
          enemy.y + 300 + wOffset,
          Math.max(5, size) + 5,
          0,
          2 * Math.PI
        )
        ctx.stroke()
      }

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
  }, [enemies, enemyProjectiles, crosshair, dimensionShift, player.w, muzzleFlash, timeWarp, damageFlash])

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
              <p className="text-red-400">• Enemies now shoot back!</p>
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

  if (gameState === 'gameOver') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-black to-red-900 flex items-center justify-center">
        <Card className="p-8 bg-black/70 border-red-500">
          <div className="text-center space-y-6">
            <h1 className="text-5xl font-bold text-red-400">GAME OVER</h1>
            <div className="space-y-2">
              <p className="text-xl text-white">Final Score: {player.score}</p>
              <p className="text-lg text-gray-300">Level Reached: {player.level}</p>
            </div>
            <div className="space-x-4">
              <Button onClick={initGame} className="px-6 py-2 bg-red-600 hover:bg-red-700">
                Try Again
              </Button>
              <Button onClick={() => setGameState('menu')} variant="outline" className="px-6 py-2">
                Main Menu
              </Button>
            </div>
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

      {/* Enemy Counter and Projectile Alert */}
      <div className="absolute bottom-4 right-4">
        <Card className="p-3 bg-black/70 border-purple-500">
          <div className="space-y-1">
            <div className="text-red-400 font-mono">
              ENEMIES: {enemies.filter(e => e.isActive).length}
            </div>
            <div className="text-orange-400 font-mono text-xs">
              INCOMING: {enemyProjectiles.length}
            </div>
          </div>
        </Card>
      </div>

      {/* Low Health Warning */}
      {player.health <= 25 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-red-500 text-2xl font-bold animate-pulse">
            LOW HEALTH!
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return <FPSGame />
}

export default App