---
trigger: always_on
---

# You Might Not Need an Effect

> Effects are an escape hatch from the React paradigm. They let you “step outside” of React and synchronize your components with some external system (e.g. a non‑React widget, network, or browser API).
> If there is no external system involved (for example, updating internal derived state from props or state), you often **don’t need** an Effect.
> Removing unnecessary Effects leads to simpler, faster, and less error‑prone code.

---

## What You’ll Learn

- Why and how to remove unnecessary Effects
- How to cache expensive computations without Effects
- How to reset or adjust component state without Effects
- How to share logic between event handlers instead of Effects
- Which logic belongs in Effects vs event handlers
- How to notify parent components about state changes correctly

---

## How to Remove Unnecessary Effects

Two common scenarios where you don’t need an Effect:

1. **Transformations purely for rendering**
   If you want to derive some value from props or state for rendering (e.g. a filtered list), don’t put it in state + Effect. Instead, compute it directly in the render body.
   Effects cause extra render passes and complexity.

2. **Reacting to user events**
   If logic should run because the user interacted (e.g. clicked a button), it belongs in event handlers — not in Effects. By the time an Effect runs, you often lose the context of *which* event triggered it.

You **do** need Effects when synchronizing with external systems — e.g. subscribing to an API, interacting with DOM APIs, or doing data fetching. But even then, keep them minimal.

---

## Common Patterns & Refactor Examples

### Updating State Based on Props or State

**Anti-pattern:**

```jsx
function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    setFullName(firstName + ' ' + lastName);
  }, [firstName, lastName]);

  // ...
}
```

**Refactor: compute during render**

```jsx
function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');

  const fullName = firstName + ' ' + lastName;

  // ...
}
```

Compute derived values directly rather than storing them in state + Effect.

---

### Caching Expensive Computations

If a derived calculation is expensive and you want to avoid recomputing it unnecessarily, use `useMemo`, not an Effect:

```jsx
function TodoList({ todos, filter }) {
  const [newTodo, setNewTodo] = useState('');

  const visibleTodos = useMemo(
    () => getFilteredTodos(todos, filter),
    [todos, filter]
  );

  // ...
}
```

Because the function inside `useMemo` runs during rendering, it’s suitable for **pure computations**, not side effects.

---

### Resetting All State When a Prop Changes

If a component should be “reset” when a prop changes (e.g. switching user profiles), avoid resetting via Effect. Instead, use React’s `key` prop to remount:

```jsx
function ProfilePage({ userId }) {
  return <Profile key={userId} userId={userId} />;
}

function Profile({ userId }) {
  const [comment, setComment] = useState('');
  // This state resets automatically when `key` changes.
}
```

---

### Adjusting Some State When Props Change

Sometimes you only want to reset part of the state when a prop changes. While you **can** do it imperatively, evaluate whether you can derive the new value during render:

```jsx
function List({ items }) {
  const [isReverse, setIsReverse] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const selection = items.find(item => item.id === selectedId) ?? null;

  // ...
}
```

This eliminates the need for a state-resetting Effect. If the selected item is no longer in `items`, `selection` becomes `null`.

---

### Sharing Logic Between Event Handlers Instead of Effects

**Anti-pattern:**

```jsx
useEffect(() => {
  if (product.isInCart) {
    showNotification(`Added ${product.name}!`);
  }
}, [product]);

function handleBuyClick() { addToCart(product); }
function handleCheckoutClick() { addToCart(product); /* navigate */ }
```

Problems:

- Notification might fire on mount (if `product.isInCart` is already `true`)
- You lose context of *which* event caused the update

**Refactor: Move logic into a shared handler**

```jsx
function buyProduct() {
  addToCart(product);
  showNotification(`Added ${product.name}!`);
}

function handleBuyClick() { buyProduct(); }
function handleCheckoutClick() {
  buyProduct();
  navigateTo('/checkout');
}
```

Everything happens in response to event — no Effect needed.

---

## Recap (Key Guidelines)

- If you can **calculate** something during render, don’t use an Effect for it.
- Use `useMemo` — not `useEffect` — to cache expensive derived computations.
- To reset an entire subtree’s state, use a different `key`.
- To reset or adjust a part of state on prop change, do it during render.
- Logic triggered by component mount or display belongs in Effects; logic triggered by user actions belongs in event handlers.
- If multiple components must update, do it in one event to avoid chains of Effects.
- Lift state up rather than synchronizing states across components.
- Fetch data in Effects **only when necessary**, with proper cleanup to avoid race conditions.
- Whenever an Effect seems too heavyweight or redundant, see if it can be replaced by a custom Hook or moved elsewhere.
