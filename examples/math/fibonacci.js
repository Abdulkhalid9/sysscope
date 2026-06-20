function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}
for (let i = 0; i < 10; i++) process.stdout.write(fib(i) + " ");
console.log();