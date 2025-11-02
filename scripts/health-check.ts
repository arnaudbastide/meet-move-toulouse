const url = process.argv[2] ?? 'http://localhost:8787/health';

async function main() {
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'health-check-script' } });
    if (!response.ok) {
      console.error(`Request failed with status ${response.status}`);
      process.exitCode = 1;
      return;
    }

    const body = await response.json();
    console.log(JSON.stringify(body));
  } catch (error) {
    console.error(`Failed to reach ${url}:`, error);
    process.exitCode = 1;
  }
}

void main();
