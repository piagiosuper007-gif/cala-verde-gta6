// Keyboard + mouse for CALA VERDE. One job: turn raw input into a clean state
// the loop reads — keys held, orbit drag deltas, wheel zoom, single key presses.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(), // consumed once per frame by the loop
    dragDX: 0,
    dragDY: 0,
    wheel: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
  };

  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!e.repeat) input.pressed.add(k);
    input.keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    input.keys.delete(k);
  });
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('pointerdown', (e) => {
    input.dragging = true;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!input.dragging) return;
    input.dragDX += e.clientX - input.lastX;
    input.dragDY += e.clientY - input.lastY;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  const endDrag = () => { input.dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => { input.wheel += e.deltaY; }, { passive: true });

  input.isDown = (name) => input.keys.has(name);
  input.wasPressed = (name) => input.pressed.has(name);
  input.endFrame = () => {
    input.pressed.clear();
    input.dragDX = 0;
    input.dragDY = 0;
    input.wheel = 0;
  };
  // forward = W / Up, back = S / Down, left = A / Left, right = D / Right
  input.axis = () => {
    const f = (input.keys.has('w') || input.keys.has('ArrowUp') ? 1 : 0)
      - (input.keys.has('s') || input.keys.has('ArrowDown') ? 1 : 0);
    const r = (input.keys.has('d') || input.keys.has('ArrowRight') ? 1 : 0)
      - (input.keys.has('a') || input.keys.has('ArrowLeft') ? 1 : 0);
    return { f, r };
  };
  return input;
}
