var shortest_paths;  // Do not write after initial setting.
var predecessors;
var current_path;  // Will be written by make_move

function xy_to_vertex_number(x, y) {
    return y * WIDTH + x;
}

function init_map() {
    // Initialize a map. More readable than checking
    // for undefined on every access below.
    m = {};
    for (var x = 0; x < HEIGHT*WIDTH; ++x) {
        m[x] = {};
    }
    return m;
}

function grid_adjacent(v, u) {
    // Computes from the vertex numbers whether
    // two grid spaces are adjacent. No diagonals.
    // See notes for derivation of this formula.
    return ((Math.abs(v - u) == 1 &&
             Math.abs(v % WIDTH - u % WIDTH) == 1) ||
            // N.B. v - u % WIDTH != v % WIDTH - u % WIDTH
             Math.abs(v - u) == WIDTH);
}

function initialize_weights() {
    // Init weight matrix (D0 for Floyd-Warshall).
    // Treat board as graph with each space a vertex
    // and edges from each vertex to any to the NORTH,
    // SOUTH, EAST, or WEST of it. Each edge has a weight
    // of 1 (# of turns to traverse it). 
    var current_paths = init_map();
    // Set D0.
    for (var i = 0; i < HEIGHT*WIDTH; ++i) {
        for (var j = 0; j < HEIGHT*WIDTH; ++j) {
            if (i == j) {
                current_paths[i][j] = 0;
            }
            else if (grid_adjacent(i, j)) {
                current_paths[i][j] = 1;
            }
            else {
                current_paths[i][j] = Infinity;
            }
        }
    }
    return current_paths;
}

function initialize_preds(weights) {
    // Initialize predecessor map for Floyd-Warshall.
    var preds = init_map();
    for (var i = 0; i < HEIGHT*WIDTH; ++i) {
        for (var j = 0; j < HEIGHT*WIDTH; ++j) {
            if (weights[i][j] < Infinity && i != j) {
                preds[i][j] = i;
            }
            else {
                preds[i][j] = null;
            }
        }
    }
    return preds;
}

function new_game() {
    // Floyd-Warshall to find all-pairs shortest paths
    // for the board.
    var current_paths = initialize_weights();  // D0 of Floyd-Warshall.
    var current_preds = initialize_preds(current_paths);
    var n = WIDTH*HEIGHT;
    for (var k = 0; k < n; ++k) {
        var next_paths = init_map();
        var next_preds = init_map();
        for (var i = 0; i < n; ++i) {
            for (var j = 0; j < n; ++j) {
                if (current_paths[i]) {
                    next_paths[i][j] =
                        Math.min(current_paths[i][j],
                                 current_paths[i][k] + current_paths[k][j]);
                    if (next_paths[i][j] == current_paths[i][j]) {
                        next_preds[i][j] = current_preds[i][j];
                    }
                    else {
                        next_preds[i][j] = current_preds[k][j];
                    }
                }
            }
        }
        current_paths = next_paths;
        current_preds = next_preds;
    }
    shortest_paths = current_paths;
    predecessors = current_preds;
}

function within_radius(origin, r) {
    // Finds all spaces within the Manhattan radius r of
    // the current space (a two-element array). I.e. all
    // spaces which can be reached in r moves from origin.
    var in_radius = [];
    for (var a = 0; a <= Math.floor(r/2); ++a) {
        var b = r - a;
        // Too lazy to work out the formula. Plus, this
        // ought to be a bit faster.
        var spaces = [[origin[0] + a, origin[1] + b],
                      [origin[0] + a, origin[1] - b],
                      [origin[0] - a, origin[1] + b],
                      [origin[0] - a, origin[1] - b],
                      [origin[0] + b, origin[1] + a],
                      [origin[0] + b, origin[1] - a],
                      [origin[0] - b, origin[1] + a],
                      [origin[0] - b, origin[1] - a]];
        for (var i = 0; i < spaces.length; ++i) {
            var space = spaces[i];
            if (0 <= space[0] && space[0] < WIDTH &&
                0 <= space[1] && space[1] < HEIGHT) {
                in_radius.push(space);
            }
        }
    }
    return in_radius;
}

function which_side(i, j) {
    // Returns NORTH, SOUTH, EAST, WEST depending on which
    // direction one must go from i to reach j.
    diff = i - j;
    switch (diff) {
        case  1: return WEST;
        case -1: return EAST;
        case  WIDTH: return NORTH;
        case -WIDTH: return SOUTH;
        default: throw {message : "which_side screwed up!"};
    }
}
        
function path_lookup(i, j) {
    // Look up the shortest path from i to j. Return as a list.
    path = [j];
    current_pred = j;
    while (current_pred != i) {
        current_pred = predecessors[i][current_pred];
        path.unshift(current_pred);
    }
    movements = []
    for (var c = 1; c < path.length; ++c) {
        movements.push(which_side(path[c-1], path[c]));
    }
    return movements;
}

function evaluate_space(board, space, origin) {
    // Determine the value of a space on the board.
    // For now just return 0 for empty and 1 for a space
    // with a fruit.
    var spaceval = board[spacex][spacey];
    if (spaceval > 0) {
        // See notes for the logic here.
        var fruitval = get_total_item_count(spaceval) /
            get_my_item_count(spaceval);
        return fruitval - ((space[0] - origin[0]) +
                           (space[1] - origin[1]))/2;
    }
    return 0;
}

function shuffle_array(a) {
    // Randomly shuffle array using Fisher-Yates method.
    var i = a.length;
    if (!i) return false;
    while (--i) {
        var j = Math.floor(Math.random() * (i+1));
        var tempi = a[i];
        var tempj = a[j];
        a[i] = tempj;
        a[j] = tempi;
    }
}

function make_move() {
    var board = get_board();
    var origin = [get_my_x(), y = get_my_y()];
    if (evaluate_space(board, origin, origin))
        return TAKE;
    if (!current_path || current_path.length == 0) {
        var next_dest;
        next_move:
        for (var r = 1; ; ++r) {
            // Search for a space with a fruit on it.
            var spaces = within_radius([x, y], r);
            var valuations = {};
            for (var i = 0; i < spaces.length; ++i) {
                var space = spaces[i];
                if (evaluate_space(board, space, [x, y])) {
                    next_dest = space;
                    break next_move;
                }
            }
        }
            var current_pos = xy_to_vertex_number(x, y);
            var next_pos = xy_to_vertex_number(next_dest[0], next_dest[1]);
            current_path = path_lookup(current_pos, next_pos);
    }
    return current_path.shift();
}

// Optionally include this function if you'd like to always reset to a 
// certain board number/layout. This is useful for repeatedly testing your
// bot(s) against known positions.
//
function default_board_number() {
   return 123;
}

/* Three things to improve on:
   - Avoid ties. Maybe save the most valuable space from each
     radius up to some maximum radius (like maybe the mean of
     the height and width) and compare them all at the end.
   - Better evaluation function. This will be hard but I have
     some ideas; see the notes.
   - Don't set a path and then mindlessly follow it to the end;
     do some reevaluation as you go.
*/
