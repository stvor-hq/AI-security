/**
 * CyberpunkLogger - highly stylized ANSI terminal logger for demo visualization
 */
const ESC = '\u001b[';

const styles = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  flash: `${ESC}5m`,
  neonGreen: `${ESC}38;2;57;255;20m`,
  cyan: `${ESC}38;2;0;255;255m`,
  magenta: `${ESC}38;2;255;0;255m`,
  yellow: `${ESC}38;2;255;215;0m`,
  red: `${ESC}38;2;255;60;60m`,
  dim: `${ESC}2m`,
  boxBg: `${ESC}48;2;6;6;15m`,
};

function padCenter(s: string, width = 60) {
  const left = Math.max(0, Math.floor((width - s.length) / 2));
  const right = Math.max(0, width - s.length - left);
  return ' '.repeat(left) + s + ' '.repeat(right);
}

export class CyberpunkLogger {
  static banner(text = 'STVOR CLOUD NODE v1.0.0') {
    const width = 68;
    console.log(styles.boxBg + styles.cyan + styles.bold + ' '.repeat(width + 4));
    console.log(styles.boxBg + styles.cyan + `${' '.repeat(2)}${padCenter(text, width)}${' '.repeat(2)}`);
    console.log(styles.boxBg + styles.cyan + styles.reset);
    console.log(styles.reset);
  }

  static header(title: string) {
    console.log(styles.bold + styles.cyan + `
┌─ ${title} ${'─'.repeat(Math.max(0, 56 - title.length))}` + styles.reset);
  }

  static success(agent: string, msg: string) {
    console.log(`${styles.neonGreen}${styles.bold}» [${agent}]${styles.reset} ${styles.neonGreen}${msg}${styles.reset}`);
  }

  static info(agent: string, msg: string) {
    console.log(`${styles.cyan}→ [${agent}]${styles.reset} ${msg}`);
  }

  static escrow(msg: string) {
    console.log(`${styles.magenta}${styles.bold}✦ ESCROW${styles.reset} ${styles.magenta}${msg}${styles.reset}`);
  }

  static warn(prefixOrMsg: string, msg?: string) {
    const output = msg !== undefined ? `${prefixOrMsg}: ${msg}` : prefixOrMsg;
    console.log(`${styles.yellow}${styles.bold}⚠ ${output}${styles.reset}`);
  }

  static alert(msg: string) {
    console.log(`${styles.flash}${styles.red}${styles.bold}‼ [SECURITY-ALERT] ${msg}${styles.reset}`);
  }

  static arrow(from: string, to: string, label?: string) {
    const arrow = `${styles.dim}${from} ${styles.reset}${styles.cyan}→${styles.reset} ${styles.dim}${to}${styles.reset}`;
    if (label) {
      console.log(`${arrow} ${styles.yellow}${label}${styles.reset}`);
    } else {
      console.log(arrow);
    }
  }

  static box(title: string, lines: string[]) {
    const width = Math.max(...lines.map((l) => l.length), title.length) + 4;
    console.log(styles.magenta + `┏${'━'.repeat(width)}┓` + styles.reset);
    console.log(styles.magenta + `┃ ${styles.bold}${title}${styles.reset}${' '.repeat(width - title.length - 1)}┃` + styles.reset);
    console.log(styles.magenta + `┣${'━'.repeat(width)}┫` + styles.reset);
    for (const l of lines) {
      console.log(styles.magenta + `┃ ${l}${' '.repeat(width - l.length - 1)}┃` + styles.reset);
    }
    console.log(styles.magenta + `┗${'━'.repeat(width)}┛` + styles.reset);
  }
}

export default CyberpunkLogger;
