from time import perf_counter


class Timer:
    def __init__(self) -> None:
        self._start = perf_counter()

    @property
    def elapsed(self) -> float:
        return round(perf_counter() - self._start, 2)
