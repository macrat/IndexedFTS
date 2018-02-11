import numeric from './numeric';
import search from './search';


function zfill(n, str) {
	str = `${str}00000`;
	return str.slice(0, str.length-n-1);
}

(async () => {
	const baseConfig = {
		beforeEach(count, bench) {
			document.querySelector('#current-bench').innerText = bench.name;
			document.querySelector('#status').innerText = 'execute...';
		},
		benchmarkDefault: {
			after(result) {
				document.querySelector('#current-bench').innerText = '';
				document.querySelector('#status').innerText = 'done';
				console.log('done: ' + result);

				const avg = zfill(5, Math.round(result.average * 100000) / 100000);
				const error = zfill(5, Math.round(result.error * 100000) / 100000);
				const rate = zfill(3, Math.round(result.errorRate * 100000) / 1000);
				document.querySelector('#results').innerHTML += `<tr><th align=left>${result.name}</th><td align=right>${avg}</td><td align=right>${error}</td><td>${rate}%</td><td>${result.msecs.length}</td></tr>`;
			},
		},
	}

	console.log('start test');

	try {
		const n = numeric(baseConfig);
		await n.run();

		const s = search(baseConfig);
		await s.run()

		document.querySelector('#loading').style.display = 'none';
		console.log('done all');
	} catch (err) {
		console.error(err);
		document.querySelector('#status').innerText = 'something error! please see log';
	}
})();
