# TaruGit

Cliente visual de **Git** para escritorio, construido con [Tauri 2](https://tauri.app/), React, TypeScript y Rust.

TaruGit ofrece una interfaz amigable para trabajar con repositorios Git locales y remotos (GitHub): revisar cambios, hacer commits, gestionar ramas, resolver conflictos, trabajar con stash y tags, sincronizar con el remoto y consultar GitHub Actions y Pull Requests, todo en una sola ventana de escritorio.

## Características

### Repositorios
- Abrir repositorios locales o clonar desde una URL
- Guardar múltiples repositorios y cambiar entre ellos rápidamente (`Ctrl + P`)
- Watcher de archivos que actualiza el estado del repo automáticamente

### Cambios y commits
- Listado de archivos modificados con su estado (nuevo, modificado, eliminado, conflicto)
- Visor de diffs por archivo (unified diff)
- Stage/unstage y descartar cambios
- Commit con selección de autor (múltiples usuarios guardados) y soporte para *amend*
- Último mensaje de commit reutilizable

### Ramas
- Crear, eliminar (individual o en lote) y cambiar de rama
- Checkout de ramas remotas
- Comparación de ramas (`Ctrl + Shift + D`)
- Buscador rápido de ramas (`Ctrl + L`)
- Gráfico visual de ramas y commits

### Integración
- Merge, rebase (con continue/abort), cherry-pick y squash
- Detección y resolución de conflictos con editor visual
- Stash: guardar, aplicar, pop, drop y limpiar
- Tags: listar, crear y eliminar
- Push, pull, fetch y sincronización con el remoto (`Ctrl + Shift + S`)

### Historial
- Historial de commits con autor y timestamp
- Ver los cambios de cada commit (diff por archivo)
- Historial por archivo

### GitHub
- GitHub Actions: listar ejecuciones de workflows y sus jobs
- Pull Requests: listar, crear, fusionar, actualizar y ver archivos/commits

### Experiencia
- Interfaz en español con tema oscuro
- Editor integrado (CodeMirror) con resaltado de sintaxis para múltiples lenguajes
- Barra lateral redimensionable y colapsable (`Ctrl + B`)
- Atajos de teclado (`Ctrl + /` para ver la ayuda completa)

## Tecnologías

- **Frontend:** React 19, TypeScript, Vite 7, CodeMirror 6, diff, PrismJS
- **Backend:** Rust (Tauri 2, `git2`, `notify`, `reqwest`, `tauri-plugin-dialog`, `tauri-plugin-opener`)

## Requisitos previos

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install) (toolchain stable)
- Dependencias del sistema para Tauri (en Windows: WebView2, incluida normalmente)

## Instalación y desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar la app en modo desarrollo (compila el backend de Rust)
npm run tauri dev

# Compilar el frontend (typecheck + build de Vite)
npm run build
```

## Build de producción

```bash
npm run tauri build
```

Genera los instaladores en `src-tauri/target/release/bundle/`. También hay un workflow de GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)) que publica instaladores de Windows (NSIS `.exe` y MSI) automáticamente al crear un tag `v*`.

## Atajos de teclado

| Atajo | Acción |
| --- | --- |
| `Ctrl + 1` | Pestaña: Cambios |
| `Ctrl + 2` | Pestaña: Historial |
| `Ctrl + 3` | Pestaña: Stash |
| `Ctrl + 4` | Pestaña: Tags |
| `Ctrl + 5` / `Ctrl + Shift + K` | Actions (panel central) |
| `Ctrl + Tab` | Siguiente pestaña |
| `Ctrl + Shift + Tab` | Pestaña anterior |
| `Ctrl + B` | Colapsar/expandir barra lateral |
| `Ctrl + Shift + B` | Crear rama |
| `Ctrl + P` | Buscador de repositorios |
| `Ctrl + O` | Agregar repositorio |
| `Ctrl + Shift + S` | Modal de sincronización |
| `Ctrl + Shift + H` | Homologar ramas (actualizar master y rebase) |
| `Ctrl + E` | Cherry-pick rápido |
| `Ctrl + Shift + D` | Comparar ramas |
| `Ctrl + L` | Buscador de ramas |
| `Ctrl + Shift + Supr` | Eliminar varias ramas |
| `Ctrl + /` | Ayuda de atajos |

## Licencia

Sin licencia definida.