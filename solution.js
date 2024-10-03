function Stacker() {
	const EMPTY = 0, WALL = 1, BLOCK = 2, GOLD = 3;

	const DIRECTIONS = {
		"left": { x: 0, y: -1 },
		"right": { x: 0, y: 1 },
		"up": { x: -1, y: 0 },
		"down": { x: 1, y: 0 }
	};

	let map = {};
	let moves = [];
	let visited = new Set();
	let position = { x: 0, y: 0 };
	let goldPosition = null;

	let isGoldFound = false;
	let stairBuild = false;
	let finalClimb = false;

	let hasBlock = false;
	let goldZone = null;
	let stairPath = null;
	let currStairPath = null;

	const encodePosition = (position) => `${position.x},${position.y}`;
	const getNewPosition = (position, direction) => {
		return {
			x: position.x + DIRECTIONS[direction].x,
			y: position.y + DIRECTIONS[direction].y
		};
	};

	const isPositionTraversable = (posA, posB) => {
		const encodedA = encodePosition(posA);
		const encodedB = encodePosition(posB);
		return map[encodedA]?.type !== WALL &&
			map[encodedB]?.type !== WALL &&
			Math.abs(map[encodedA]?.level - map[encodedB]?.level) <= 1;
	};

	const getAction = (posA, posB) => {
		if (posB.x < posA.x) return "up";
		if (posB.x > posA.x) return "down";
		if (posA.y > posB.y) return "left";
		if (posA.y < posB.y) return "right";
		return;
	};

	const updateMapAndVisited = (cell) => {
		const encodedPos = encodePosition(position);
		visited.add(encodedPos);
		map[encodedPos] = { type: cell.type, level: cell.level };
		for (const direction of Object.keys(DIRECTIONS)) {
			const newPos = getNewPosition(position, direction);
			map[encodePosition(newPos)] = cell[direction];
		}
	};

	const calculateSurroundingPath = (direction) => {
		const paths = {
			left: ["up", "left", "left", "down", "down", "right"],
			right: ["down", "right", "right", "up", "up", "left"],
			up: ["right", "up", "up", "left", "left", "down"],
			down: ["right", "down", "down", "left", "left", "up"]
		};
		return paths[direction];
	};

	const findNearestCell = (predicate) => {
		const queue = [position];
		const localVisited = new Set([encodePosition(position)]);

		while (queue.length > 0) {
			const currentPosition = queue.shift();
			if (predicate(currentPosition)) return currentPosition;

			for (const direction of Object.keys(DIRECTIONS)) {
				const neighbor = getNewPosition(currentPosition, direction);
				if (isPositionTraversable(currentPosition, neighbor) && !localVisited.has(encodePosition(neighbor))) {
					localVisited.add(encodePosition(neighbor));
					queue.push(neighbor);
				}
			}
		}
		return null;
	};

	const findNearestUnvisitedCell = () => findNearestCell((pos) => !visited.has(encodePosition(pos)));

	const findNearestUnusedBlock = () => {
		return findNearestCell((pos) => map[encodePosition(pos)].type === BLOCK &&
			!goldZone.some(v => pos.x === v.x && pos.y === v.y));
	};

	const shortestPathBFS = (source, destination) => {
		const queue = [{ ...source }];
		const localVisited = new Set([encodePosition(source)]);

		while (queue.length > 0) {
			let current = queue.shift();

			if (current.x === destination.x && current.y === destination.y) {
				let path = [];
				while (current.parent) {
					path.unshift(current.action);
					current = current.parent;
				}
				return path;
			}

			for (const direction of Object.keys(DIRECTIONS)) {
				const neighbor = getNewPosition(current, direction);
				if (isPositionTraversable(current, neighbor) && !localVisited.has(encodePosition(neighbor))) {
					localVisited.add(encodePosition(neighbor));
					neighbor.parent = current;
					neighbor.action = getAction(current, neighbor);
					queue.push(neighbor);
				}
			}
		}
		return [];
	};

	const proceedToNextMove = () => {
		const move = moves.shift();
		if (DIRECTIONS.hasOwnProperty(move)) {
			position = getNewPosition(position, move);
		} else if (move === "pickup") {
			hasBlock = true;
		} else if (move === "drop") {
			hasBlock = false;
		}
		return move;
	};

	this.turn = function (cell) {

		// console.log("=== TURN START ===");
		// console.log("Position:", position);
		// console.log("Cell Type:", cell.type, "Cell Level:", cell.level);
		// console.log("Current Moves:", moves);
		// console.log("Has Block:", hasBlock);
		// console.log("Stage: ", isGoldFound ? (stairBuild ? "Stair Building" : "Climb to Gold") : "Exploration");

		updateMapAndVisited(cell);

		if (!isGoldFound) {
			for (const direction of Object.keys(DIRECTIONS)) {
				if (cell[direction].type === GOLD) {
					isGoldFound = true;
					stairBuild = true;
					goldPosition = getNewPosition(position, direction);
					stairPath = [
						{ x: goldPosition.x, y: goldPosition.y + 1 },
						{ x: goldPosition.x + 1, y: goldPosition.y + 1 },
						{ x: goldPosition.x + 1, y: goldPosition.y },
						{ x: goldPosition.x + 1, y: goldPosition.y - 1 },
						{ x: goldPosition.x, y: goldPosition.y - 1 },
						{ x: goldPosition.x - 1, y: goldPosition.y - 1 },
					];
					goldZone = stairPath.slice();
					currStairPath = stairPath.slice();
					moves = calculateSurroundingPath(direction);

					// console.log("Gold Found at:", goldPosition);
					// console.log("Stair Path initialized:", stairPath);
				}
			}

			if (moves.length === 0) {
				const nearestUnvisited = findNearestUnvisitedCell(EMPTY);
				moves = shortestPathBFS(position, nearestUnvisited);
				// console.log("Exploring, moving towards nearest unvisited cell:", nearestUnvisited);
			}
		}

		if (stairBuild && hasBlock) {
			if (moves.length === 0 && currStairPath.length > 0) {
				let target = currStairPath.shift();
				while (target && map[encodePosition(target)]?.type === BLOCK) {
					target = currStairPath.shift();
				}
				if (target) {
					moves = shortestPathBFS(position, target);
					moves.push("drop");
					// console.log("Building Stair, moving to target:", target);
				}
			}
			if (currStairPath.length == 0) {
				stairBuild = false;
				finalClimb = true;
				// console.log("Finished Stair Building, transitioning to Final Climb.");
			}
		}

		if (isGoldFound && !hasBlock) {
			if (moves.length === 0) {
				const nearestBlock = findNearestUnusedBlock();
				const nearestUnvisited = findNearestUnvisitedCell();
				const blockPath = nearestBlock ? shortestPathBFS(position, nearestBlock) : [];
				const unvisitedPath = nearestUnvisited ? shortestPathBFS(position, nearestUnvisited) : [];

				if (!nearestBlock) {
					moves = unvisitedPath;
					// console.log("No blocks nearby, exploring unvisited cells.");
				} else if (!nearestUnvisited) {
					moves = blockPath;
					moves.push('pickup');
					// console.log("Picking up nearest block:", nearestBlock);
				} else {
					moves = blockPath.length < unvisitedPath.length ? blockPath.concat('pickup') : unvisitedPath;
					// console.log("Moving to block:", nearestBlock, "or exploring:", nearestUnvisited);
				}
			}
		}

		if (finalClimb && hasBlock) {
			if (currStairPath.length == 0) {
				stairPath.pop();
				currStairPath = stairPath.slice();
			}
			if (moves.length == 0 && currStairPath.length > 0) {
				var target = currStairPath.shift();
				moves = shortestPathBFS(position, target);
				moves.push("drop");
			}
			// console.log("Final Climb: Moving towards final stair target:", target);
		}

		if (isGoldFound && stairPath.length == 0 && hasBlock) {
			if (moves.length == 0) {
				var target = getNewPosition(goldPosition, 'right');
				moves = shortestPathBFS(position, target);
				moves.push('drop');
				moves.push('left');
			}
		}

		let move = proceedToNextMove();
		// console.log("Move:", move);
		// console.log("=== TURN END ===\n");
		return move;
	};
}